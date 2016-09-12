'use strict'

const generateInvitationCodes = require('../lib/generate-invitation-codes')

function* Action_GenerateInvitationCode() {
    const {mock, r} = this
    let count = mock
              ? 10 
              : r.table('enroll').count()
    
    // generate unique randoms
    const codes = generateInvitationCodes(count)
    const ids = mock
              ? ['1', '2', '3']
              : r.table('enroll').getField('id')

    let idx = 0
    for (let id of ids) {
        let {replaced} = mock
                       ? 1
                       : yield r.table('enroll').get(id).update({ invitation: codes[idx++] })
    }

    this.status = 200
    this.body = { status: true, codes }
}

module.exports = {
    Post: function* Router_Action() {
        const {
            startLeaderReg
        } = this.query

        if (startLeaderReg) {
            yield Action_GenerateInvitationCode
            return
        }
    }
}