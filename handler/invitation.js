'use strict'

const { MOCK_VERIFIED_INVITATION } = require('../mock-data')

module.exports = {
    Get: function* Handler_Get_Invitation() {
        const {mock, r} = this
        const {invitation} = this.params

        let result = mock
                   ? MOCK_VERIFIED_INVITATION
                   : r.table('enroll').get(invitation, {index: 'invitation'})

        if (result) {
            this.status = 200
            this.body   = result 
        }else{
            this.status = 404
            this.body   = { status: false }
        }
    },
    Post: function* Handler_Post_Invitation() {
        const {mock, r} = this
        const data = this.request.body
    }
}