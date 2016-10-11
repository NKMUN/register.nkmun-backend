'use strict'

const {derive} = require('../lib/password-util')
const { MOCK_ENROLL_ENTRY } = require('../mock-data')

module.exports = {
    Get:  function* Handler_Get_Leader() {
        const {r, mock} = this
        const {id} = this.token

        // Get leader's team state
        let school = mock
                   ? MOCK_ENROLL_ENTRY
                   : yield r.table('enroll').getAll(id, {index: 'leader'})
                           .pluck('id', 'school', 'state', 'committee')
                           (0).default({})

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
    }
}