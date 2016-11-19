'use strict'

const {derive} = require('../lib/password-util')
const { MOCK_ENROLL_ENTRY, MOCK_EXCHANGE_REQUEST_ENTRY } = require('../mock-data')

function* removeUnavailableExchangeRequests(school, committee) {
    const {r, mock} = this
    if (mock)
        return

    yield r.table('enroll').get(school).getField('committee').getField(committee)
            .do( (avail) =>
                r.table('exchange').getAll(school, {index: 'to'})
                .filter( $ => $('state').eq('pending') )
                .filter( $ => r.and( $('wanted').eq(committee), $('amount').gt(avail) ) )
                .update({ state: 'unavailable' })
            )

    yield r.table('enroll').get(school).getField('committee').getField(committee)
            .do( (avail) =>
                r.table('exchange').getAll(school, {index: 'from'})
                .filter( $ => $('state').eq('pending') )
                .filter( $ => r.and( $('offer').eq(committee), $('amount').gt(avail) ) )
                .update({ state: 'unavailable' })
            )
}

function query_CheckExchangeAvailability( r, committee, amount ) {
    return (r$) => r.and(
        r$,
        r$('state').coerceTo('string').match('inviting|invited|registered'),
        r$('committee'),
        r$('committee')(committee).ge(amount)
    )
}

module.exports = {
    Get:  function* Handler_Get_Leader() {
        const {r, mock} = this
        const {id, school: schoolId = null} = this.token

        // Get leader's team state
        let school = mock
                   ? MOCK_ENROLL_ENTRY
                   : yield r.table('enroll').get(schoolId).default({})
                           .pluck('id', 'school', 'state', 'committee', 'committee2')

        if (!school.id) {
            this.status = 404
            this.body = { message: 'Leader is not associated with any school' }
            return
        }

        school.exchanges = mock
                         ? 1
                         : yield r.table('exchange').getAll(id, {index: 'to'})
                                 .filter( r.row('state').eq('pending') )
                                 .count()
        school.paymentStatus = mock
                             ? { state: 'accepted', reason: null }
                             : yield r.table('payment').get(schoolId).default({})
                               .pluck('state', 'reason')
        school.paymentStatus2 = mock
                              ? { state: 'accepted', reason: null }
                              : yield r.table('payment2').get(schoolId).default({})
                                .pluck('state', 'reason')

        this.status = 200
        this.body   = school
    },
    Post: function* Handler_Post_Leader() {
        const {mock, r} = this
        const {invitation} = this.query
        let data = this.is('multipart') ? this.request.body.fields : this.request.body

        let {email: user, password} = data
        data.id = data.email
        delete data.password

        let result = mock
                   ? { school: 'test-school', id: 'test-school' }
                   : yield r.table('enroll').getAll(invitation, {index: 'invitation'})
                           .pluck('school', 'id')

        if (result.length === 0) {
            this.status = 404
            this.body   = { status: false, message: 'Invalid Invitation' }
            return
        }

        if (result.length > 1) {
            this.status = 409
            this.body   = { status: false, message: 'Multiple schools with same invitation, please contact staff!' }
            return
        }

        let {
            school,
            id: schoolId
        } = result[0]

        let {
            inserted
        } = mock
          ? { inserted: 1 }
          : yield r.table('leader').insert(data)

        if (!inserted) {
            this.status = 409
            this.body   = { status: false, message: 'Leader Already registered' }
            return
        }

        // create team leader's user
        const {hash, salt} = derive(password)

        ;({
            inserted
        } = mock
          ? { inserted: 1 }
          : yield r.table('user').insert({
              id: user,
              hash,
              salt,
              access: 'leader',
              school: schoolId
          })
        )

        if (!inserted) {
            this.status = 409
            this.body   = { status: false, message: 'User Already registered' }
            return
        }

        // update enroll
        let {
            replaced
        } = mock
          ? { replaced: 1 }
          : yield r.table('enroll').get(schoolId)
                  .replace( $ => $.without('invitation').merge({
                      state:  'registered',
                      leader: user
                  }) )

        if (!replaced) {
            this.status = 203
            this.body   = { status: true, message: 'Invitation already removed, possibly race condition' }
            return
        }

        this.status = 200
        this.body   = { status: true }
    },
    GiveupQuota: function* Handler_Post_Leader_GiveupQuota() {
        const {mock, r} = this
        const {school} = this.token
        const {committee} = this.params
        const amount = Math.floor( Number( (this.is('multipart') ? this.request.body.fields : this.request.body).amount) )

        let {
            replaced,
            unchanged
        } = mock
          ? { replaced: 1 }
          : yield r.table('enroll').get(school)
                  .update( $ => r.branch(
                      $('committee')(committee).ge(amount),
                      { committee: { [committee]: $('committee')(committee).sub(amount) } },
                      {}
                  ) )
        if (unchanged) {
            this.status = 410
            this.body = { status: false, message: 'Insufficient Quota' }
            return
        }
        if (!replaced) {
            this.status = 404
            this.body = { status: false, message: 'Committee or school does not exist'}
            return
        }
        yield removeUnavailableExchangeRequests.call(this, school, committee)
        // return current quotas
        this.body = mock
                  ? MOCK_ENROLL_ENTRY.committee
                  : yield r.table('enroll').get(this.token.school).getField('committee')
    },
    GetExchangeRequest: function* Handler_Get_Leader_PendingExchangeRequest() {
        const {mock, r} = this
        const {school: schoolId} = this.token
        let exchangeReqs = mock
                         ? [MOCK_EXCHANGE_REQUEST_ENTRY, MOCK_EXCHANGE_REQUEST_ENTRY]
                         : yield r.table('exchange').getAll(schoolId, {index: 'to'})
                                 .filter( r.row('state').eq('pending') )
                                 .eqJoin('from', r.table('enroll'))
                                 .map({
                                     id:     r.row('left')('id'),       // exchange req id
                                     from:   r.row('right')('school'),  // school name
                                     offer:  r.row('left')('offer'),
                                     wanted: r.row('left')('wanted'),
                                     amount: r.row('left')('amount'),
                                     note:   r.row('left')('note').default(null)
                                 })
        this.status = 200
        this.body = exchangeReqs
    },
    PostExchangeRequest: function* Handler_Post_Leader_ExchangeRequest() {
        const {mock, r} = this
        const {school: schoolId} = this.token

        let {
            from,
            to,
            wanted,
            offer,
            amount,
            note = null
        } = this.is('multipart') ? this.request.body.fields : this.request.body

        // verify access
        if (schoolId !== from) {
            this.status = 403
            this.body = { status: false, message: 'Access denied' }
            return
        }

        // check request is meaningful
        if (from === to || wanted === offer || Number(amount) < 1) {
            this.status = 400
            this.body = { status: false, message: 'Invalid parameters' }
            return
        }

        let available = mock
                      ? true
                      : r.and(
                          r.table('enroll').get(from).do( query_CheckExchangeAvailability(r, offer, amount) ),
                          r.table('enroll').get(to).do( query_CheckExchangeAvailability(r, wanted, amount) )
                      )

        if (!available) {
            this.status = 410
            this.bosy = { status: false, message: 'No available quota' }
            return
        }

        let {
            inserted
        } = mock
          ? { inserted: 1 }
          : yield r.table('exchange').insert({ from, to, offer, wanted, amount, state: 'pending', note })

        if (inserted) {
            this.status = 200
            this.body = { status: true, message: 'Exchange request submitted' }
        } else {
            this.status = 500
            this.body = { status: false, message: 'Exchange request creation failed'}
        }
    },
    FetchExchangeRequest: function* Handler_FetchExchangeRequest(next) {
        const {mock, r} = this
        let req = mock
                ? MOCK_EXCHANGE_REQUEST_ENTRY
                : yield r.table('exchange').get(this.params.xid)
        if (!req) {
            this.status = 404
            this.body = { status: false, message: 'Exchange does not exist' }
            return
        }
        if (req.to !== this.token.school) {
            this.status = 403
            this.body = { status: false, message: 'Exchange is not offered to current leader' }
            return
        }
        this.exchangeRequest = req
        yield next
    },
    RefuseExchangeRequest: function* Handler_Leader_RefuseExchangeRequest() {
        const {mock, r} = this

        ;( mock
         ? null
         : yield r.table('exchange').get(this.exchangeRequest.id).delete()
        )

        this.status = 200
        this.body = { status: true, message: 'Request refused' }
    },
    AcceptExchangeRequest: function* Handler_Leader_AcceptExchangeRequest() {
        const {mock, r} = this

        let {
            id,
            from,
            to,
            wanted,
            offer,
            amount,
            state
        } = this.exchangeRequest

        if (state !== 'pending') {
            this.status = 409
            this.body = { status: false, message: 'Request already processed' }
            return
        }

        let available = mock
                      ? true
                      : yield r.and(
                          r.table('enroll').get(from).do( query_CheckExchangeAvailability(r, offer, amount) ),
                          r.table('enroll').get(to).do( query_CheckExchangeAvailability(r, wanted, amount) )
                      )

        if (!available) {
            this.status = 410
            this.body = { status: false, message: 'Insufficient quota' }
            return
        }

        ;( mock
         ? null
         : yield r.table('enroll').get(from)
                 .update({
                     committee: {
                         [offer]:  r.row('committee')(offer).sub(amount),
                         [wanted]: r.row('committee')(wanted).add(amount)
                     }
                 })
        )

         ;( mock
          ? null
          : yield r.table('enroll').get(to)
                  .update({
                      committee: {
                          [offer]:  r.row('committee')(offer).add(amount),
                          [wanted]: r.row('committee')(wanted).sub(amount)
                      }
                  })
         )

         ;( mock
          ? null
          : yield r.table('exchange').get(id).update({ state: 'accepted' })
         )

         // remove requests that can't be fulfilled
         yield removeUnavailableExchangeRequests.call(this, from, offer)
         yield removeUnavailableExchangeRequests.call(this, to, wanted)

         // return current committee quota
         this.status = 200
         this.body = mock
                   ? MOCK_ENROLL_ENTRY.committee
                   : yield r.table('enroll').get(this.token.school).getField('committee')
    },
    ConfirmQuota: function* Handler_Leader_ConfirmQuota() {
        const {mock, r} = this
        const {school: schoolId} = this.token
        const {optLeaderAttend} = this.is('multipart') ? this.request.body.fields : this.request.body

        if (!mock) {
            yield r.table('exchange').getAll(schoolId, {index: 'from'}).update({ state: 'refused' })
            yield r.table('exchange').getAll(schoolId, {index: 'to'}).update({ state: 'refused' })
            yield r.table('enroll').get(schoolId).update({
                state: 'quota-confirmed',
                committee: { 'loc_absent_leader': optLeaderAttend ? 0 : 1 }
            })
        }

        this.status = 200
        this.body = { status: true, message: 'Quota confirmed' }
    }
}
