'use strict'

module.exports = {
    Post: function* Handler_Post_Leader() {
        const {mock, r} = this
        const {invitation} = this.query
        let data = this.is('multipart') ? this.request.body.fields : this.request.body

        let {email: user, password} = data
        data.id = data.email
        delete data.password

        let invited = mock
                    ? true
                    : yield r.table('enroll').get(invitation, {index: 'invitation'})
                            .coerceTo('bool')

        if (!invited) {
            this.status = 410
            this.body   = { status: false, message: 'Invalid Invitation' }
            return
        }

        let {inserted} = mock
                       ? { inserted: 1 }
                       : yield r.table('leader').insert(data)
        
        if (!inserted) {
            this.status = 409
            this.body   = { status: false, message: 'Leader Already registered' }
            return
        }

        ;({inserted} = mock
                     ? { inserted: 1 }
                     : yield r.table('user').insert({ id: user, password, access: 'leader' })
        )

        if (!inserted) {
            this.status = 409
            this.body   = { status: false, message: 'User Already registered' }
            return
        }

        let {replaced} = mock
                       ? { replaced: 1 }
                       : yield r.table('enroll').get(invitation, {index: 'invitation'})
                               .replace( $ => $.without('invitation') )

        if (!replaced) {
            this.status = 203
            this.body   = { status: true, message: 'Invitation already removed, possibly race condition' }
            return 
        }

        this.status = 200
        this.body   = { status: true }
    }
}