'use strict'

const COMMITTEE_PRICE = {
    "loc_absent_leader": 350,
    "loc_observer": 350,
    "loc_superv": 0,
    "*": 750
}

const {readFile, unlink} = require('mz/fs')
const MailerSendMail = require('./lib/send-mail')
const createSuccessEmail = require('../lib/create-payment2-success-email')
const createFailureEmail = require('../lib/create-payment2-failure-email')
const {getBillingJSON, getAccommodationPrice} = require('./lib/billing')

function* respondWithSchoolBilling(schoolId) {
    const {mock, r} = this
    const {access} = this.token

    if (mock) {
        this.status = 200
        this.body = { total: 0 }
        return
    }

    let {state, committee2: committee} = yield r.table('enroll').get(schoolId).default({}).pluck('state', 'committee2')
    let reservations = yield r.table('reservation2').getAll(schoolId, {index: 'school'})

    if (!committee) {
        this.status = 404
        this.body = { status: false, message: 'School not found' }
        return
    }

    if (  state !== 'accommodation-confirmed-2'
       && state !== 'payment-rejected-2'
       && access !== 'admin'
    ) {
        this.status = 412
        this.body = { status: false, message: 'School not eligible for billing' }
        return
    }

    this.status = 200
    this.body = getBillingJSON({
        committee: committee,
        reservations,
        committeePrice: COMMITTEE_PRICE,
        accommodationPrice: yield getAccommodationPrice(r, 'accommodation'),
    })
}

module.exports = {
    Post: function* Handler_Post_PaymentCredential() {
        const {mock, r} = this
        const {school: schoolId} = this.token

        if ( ! this.is('multipart') ) {
            this.status = 415
            this.body = { status: false, message: 'Expect multipart/form-data' }
            return
        }

        let {mime} = this.request.body.fields
        let {path, size} = this.request.body.files['cred'] || {}

        if (!path || !size) {
            this.status = 400
            this.body = { status: false, message: 'Credential required' }
            return
        }

        if (mock) {
            this.status = 200
            this.body = { status: true, message: 'Credential uploaded' }
            return
        }

        let {inserted, replaced, unchanged} = yield r.table('payment2').insert({
            id: schoolId,
            mime,
            buffer: yield readFile(path),
            state: null
        }, {
            conflict: 'update'
        })

        if (!inserted && !replaced && !unchanged) {
            this.status = 500
            this.body = { status: false, message: 'Internal Error during db insertion' }
            return
        }

        yield r.table('enroll').get(schoolId).update({ state: 'paid-2' })

        this.status = 200
        this.body = { status: true, message: 'Credential uploaded' }
    },
    Get: function* Handler_Get_Billing() {
        let { school: schoolId } = this.token
        yield respondWithSchoolBilling.call(this, schoolId)
    },
    GetId: function* Handler_Get_BillingId() {
        let schoolId = this.params.id
        yield respondWithSchoolBilling.call(this, schoolId)
    },
    GetList: function* Handler_Get_Paid_List() {
        const {mock, r} = this
        if (mock) {
            this.status = 200
            this.body = []
            return
        }
        this.status = 200
        this.body = yield r.table('payment2').pluck('id', 'state')
    },
    GetPaymentCredential: function* Handler_Get_PaymentCredential() {
        const {mock, r} = this
        let schoolId = this.params.id
        if (mock) {
            this.status = 204
            return
        }

        let {mime, buffer, timestamp} = yield r.table('payment2').get(schoolId).default({})
        if (!buffer) {
            this.status = 404
            return
        }

        this.status = 200
        this.set('Content-Type', mime)
        this.set('X-Timestamp', timestamp)
        this.body = buffer
    },
    PostReview: function* Handler_Post_PaymentReview() {
        const {mock, r, mailer, NOTICE_MAIL_FROM} = this
        const {id} = this.params
        let {accept, reject, amount} = this.is('multipart') ? this.request.body.fields : this.request.body

        if ( (accept && reject) || (!accept && !reject) ) {
            this.status = 400
            this.body = { status: false, message: 'Can not accept and reject at the same time' }
            return
        }

        if (accept) {
            if (!mock) {
                yield r.table('payment2').get(id).update({ state: 'accepted', timestamp: r.now().toEpochTime() })
                yield r.table('enroll').get(id).update({ state: 'payment-confirmed-2', paidAmount: r.row('paidAmount').default(0).add(accept) })
                try {
                    let mailOpts = {
                        from: NOTICE_MAIL_FROM,
                        to: yield r.table('enroll').get(id).getField('leader'),
                        subject: '2017汇文国际中学生模拟联合国大会缴费成功通知',
                        html: createSuccessEmail({
                            school: id,
                            money: accept
                        })
                    }
                    yield MailerSendMail(mailer, mailOpts)
                } catch(e) {
                    console.log(e)
                    this.status = 500
                    this.body   = { status: false, message: 'Mail delivery failed', error: e.message }
                    return
                }
            }
            this.status = 200
            this.body = { status: true, message: 'Payment verified' }
        }

        if (reject) {
            if (!mock) {
                yield r.table('payment2').get(id).update({ state: 'rejected', timestamp: r.now().toEpochTime(), reason: reject })
                yield r.table('enroll').get(id).update({ state: 'payment-rejected-2' })
                try {
                    let mailOpts = {
                        from: NOTICE_MAIL_FROM,
                        to: yield r.table('enroll').get(id).getField('leader'),
                        subject: '[重要] 2017汇文国际中学生模拟联合国大会缴费失败通知',
                        html: createFailureEmail({
                            school: id,
                            reason: reject
                        })
                    }
                    yield MailerSendMail(mailer, mailOpts)
                } catch(e) {
                    this.status = 500
                    this.body   = { status: false, message: 'Mail delivery failed', error: e.message }
                    return
                }
            }
            this.status = 200
            this.body = { status: true, message: 'Payment rejected' }
        }
    }
}
