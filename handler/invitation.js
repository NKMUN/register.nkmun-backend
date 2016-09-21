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
            let {replaced} = mock
                           ? { replaced: 1 }
                           : yield r.table('enroll').get(id).update({ state: 'inviting' })

            if (!replaced) {
                this.status = 500
                this.body   = { status: false, message: 'Fail to update school state' }
                return
            }

            let info, html = createInvitationMail({
                school,
                name,
                code: generateInvitationCode()
            })

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
    }
}