'use strict'

const {derive} = require('../lib/password-util')
const { MOCK_ENROLL_ENTRY, MOCK_EXCHANGE_REQUEST_ENTRY } = require('../mock-data')

module.exports = {
    Get:  function* Handler_Get_Leader() {
        const {r, mock} = this
        const {id, school: schoolId} = this.token

        // Get leader's team state
        let school = mock
                   ? MOCK_ENROLL_ENTRY
                   : yield r.table('enroll').get(schoolId).default({})
                           .pluck('id', 'school', 'state', 'committee')

        let exchangeReqs = mock
                         ? 1
                         : yield r.table('exchange').getAll(id, {index: 'to'})
                                 .filter( r.row('state').eq('pending') )
                                 .count()

        school.exchanges = exchangeReqs

        if (school.id) {
            this.status = 200
            this.body   = school
        } else {
            this.status = 404
            this.body   = {message: 'Leader is not associated with any school'}
        }
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
    GetExchangeRequest: function* Handler_Get_Leader_PendingExchangeRequest() {
        const {mock, r} = this
        const {id} = this.token
        let exchangeReqs = mock
                         ? [MOCK_EXCHANGE_REQUEST_ENTRY, MOCK_EXCHANGE_REQUEST_ENTRY]
                         : yield r.table('exchange').getAll(id, {index: 'to'})
                                 .filter( r.row('state').eq('pending') )
                                 .eqJoin('from', r.table('enroll'))
                                 .map({
                                     id:     r.row('left')('id'),       // exchange req id
                                     from:   r.row('right')('school'),  // school name
                                     offer:  r.row('left')('offer'),
                                     wanted: r.row('left')('wanted'),
                                     amount: r.row('left')('amount')
                                 })
        this.status = 200
        this.body = exchangeReqs
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
         : yield r.table('enroll').get(this.exchangeRequest.id).delete()
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
            amount
        } = this.exchangeRequest

        let available = mock
                      ? true
                      : r.table('enroll').get(from, to).getField('committee')
                        .do( (from, to) => r.and( from(offer).ge(amount), to(wanted).ge(amount) ) )

        if (!available) {
            this.status = 412
            this.body = { status: false, message: 'Insufficient quote' }
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
         ;( mock
          ? null
          : yield r.table('enroll').get(from).getField('committee').getField(offer)
                  .do( (avail) => 
                      r.table('exchange').getAll(from, {index: 'from'})
                      .filter( r.row('state').eq('pending') )
                      .filter( r.and( r.row('offer').eq(offer), r.row('amount').gt(avail) ) )
                      .delete()
                  )
         )


         ;( mock
         ? null
         : yield r.table('enroll').get(to).getField('committee').getField(wanted)
                 .do( (avail) => 
                     r.table('exchange').getAll(to, {index: 'to'})
                     .filter( r.row('state').eq('pending') )
                     .filter( r.and( r.row('wanted').eq(offer), r.row('amount').gt(avail) ) )
                     .delete()
                 )
         )

         // return current committee quote
                    
         this.status = 200
         this.body = mock
                   ? MOCK_ENROLL_ENTRY.committee
                   : yield r.table('enroll').get(this.token.school).getField('committee')
    }
}