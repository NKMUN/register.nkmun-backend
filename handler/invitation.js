'use strict'

const { MOCK_VERIFIED_INVITATION, MOCK_LEADER_CONTACT } = require('../mock-data')
const generateInvitationCode = require('../lib/generate-invitation-code')
const createInvitationMail = require('../lib/create-invitation-mail')

function MailerSendMail(mailer, opts) {
    return new Promise( (resolve, reject) => {
        mailer.sendMail(opts, (err, info)=>{
            if (err)
                reject(err)
            else
                resolve(info)
        })
    })
}

module.exports = {
    Get: function* Handler_Get_Invitation() {
        const {mock, r} = this
        const {invitation} = this.params

        let result = mock
                   ? MOCK_VERIFIED_INVITATION
                   : yield r.table('enroll').getAll(invitation, {index: 'invitation'})
                           .pluck('school', 'invitation')

        if (result.length === 1) {
            this.status = 200
            this.body   = result[0]
        } else if (result.length === 0) {
            this.status = 404
            this.body   = { status: false }
        } else {
            this.status = 409
            this.body   = { status: false, message: 'Multiple schools with same invitation, please contact staff!' }
        }
    },
    Post: function* Handler_Post_Invitation() {
        const {mock, r, mailer, NOTICE_MAIL_FROM} = this
        const {id} = this.request.body

        if (!mock && !mailer) {
            this.status = 501
            this.body = { status: false, message: 'SMTP not configured on server' }
            return
        }

        let {
            school,
            state,
            name,
            email
        } = mock
          ? Object.assign({school: id}, MOCK_LEADER_CONTACT)
          : yield r.table('enroll').get(id).default({}).pluck('school', 'state', 'name', 'email')

        if (!school) {
            this.status = 404
            this.body   = { status: false, message: 'School does not exist' }
            return
        }

        if (!state || state === 'inviting' || state === 'pending') {
            let code = generateInvitationCode()

            let {
                replaced
            } = mock
              ? { replaced: 1 }
              : yield r.table('enroll').get(id).update({ state: 'inviting', invitation: code })

            if (!replaced) {
                this.status = 500
                this.body   = { status: false, message: 'Fail to update school state' }
                return
            }

            let info, html = createInvitationMail({ school, name, code })

            try {
                let mailOpts = {
                    from: NOTICE_MAIL_FROM,
                    to: email,
                    subject: '2017汇文国际中学生模拟联合国大会名额名额分配结果',
                    html
                }
                info = mock
                     ? { response: '250 Delivered' }
                     : yield MailerSendMail(mailer, mailOpts)
            } catch(e) {
                this.status = 500
                this.body   = { status: false, message: 'Mail delivery failed', error: e }
                return
            }

            let response = parseInt(info.response)
            if (response === 250) {
                this.status = 200
                this.body   = { status: true, message: 'Mail delivered' }
            } else {
                this.status = 500
                this.body   = { status: false, message: info.response, code: response }
            }

            return
        }

        this.status = 400
        this.body   = { status: false, message: 'Current state can not be changed to inviting', state }
    },
    PostStage2: function*() {
        const {mock, r} = this
        const {id} = this.request.body

        let {
            replaced
        } = mock
          ? { replaced: 1 }
          : yield r.table('enroll').get(id).update({ state: 'stage-2' })

        if (replaced) {
            this.status = 200
            this.body = { status: true }
        }else{
            this.status = 500
            this.body = { status: false, message: 'Internal Server Error'}
        }
    }
}
