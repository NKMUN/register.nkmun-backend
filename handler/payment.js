'use strict'

const COMMITTEE_PRICE = {
    "loc_absent_leader": 350,
    "loc_observer": 350,
    "loc_superv": 0,
    "*": 750
}

const {readFile, unlink} = require('mz/fs')

function differenceOfDays(a, b) {
    return Math.round( (new Date(a) - new Date(b)) / (24*3600*1000) )
}

function getCommitteeBill(committee, PRICE) {
    let sum = 0
    for (let c in committee)
        sum += (PRICE[c]!==undefined ? PRICE[c] : PRICE['*']) * committee[c]
    return sum
}

function getAccommodationBill(reservations, PRICE) {
    return reservations.map( ({accommodation, checkIn, checkOut, amount=1}) =>
           (PRICE[accommodation]!==undefined ? PRICE[accommodation] : PRICE['*'])
         * amount
         * differenceOfDays(checkOut, checkIn)
    ).reduce( (l,r) => l+r, 0 )
}

function* getAccommodationPrice(r) {
    return yield r.table('accommodation')
                 .fold({}, (acc, $) => acc.merge(
                     r.object( $('id'), $('price') )
                 ) )
                 .merge({ '*': 9999 })
}

function* getAccommodationName(r) {
    return yield r.table('accommodation')
                 .fold({}, (acc, $) => acc.merge( 
                     r.object( $('id'), $('name').add(' / ').add($('type')) )
                 ) )
                 .merge({ '*': 'Cosmos - Galaxy' })
}

function getCommitteeBillingEntries(committee, PRICE) {
    let res = []
    let numOfNormalCommittee = 0
    for (let k in committee)
        if ( !PRICE[k] )
            numOfNormalCommittee += committee[k]
    if (numOfNormalCommittee)
        res.push({ name: '会场名额', amount: numOfNormalCommittee, price: PRICE['*'] })
    if (committee['loc_observer'])
        res.push({ name: '观察员', amount: committee['loc_observer'], price: PRICE['loc_observer'] })
    if (committee['loc_absent_leader'])
        res.push({ name: '领队不参会', amount: committee['loc_absent_leader'], price: PRICE['loc_absent_leader'] })
    return res
}

function getAccommodationBillingEntries(reservations, PRICE, NAME) {
    return reservations.map( ({accommodation, amount=1, checkIn, checkOut}) => ({
        name:   (NAME[accommodation] || NAME['*']) + ' / 日',
        price:  PRICE[accommodation]!==undefined ? PRICE[accommodation] : PRICE['*'],
        amount: amount * differenceOfDays(checkOut, checkIn)
    }))
}

function* respondWithSchoolBilling(schoolId, detail = false) {
    const {mock, r} = this
    const {access} = this.token

    if (mock) {
        this.status = 200
        this.body = { total: 0 }
        return
    }

    let {state, committee} = yield r.table('enroll').get(schoolId).default({}).pluck('state', 'committee')
    let reservations = yield r.table('reservation').getAll(schoolId, {index: 'school'})

    if (!committee) {
        this.status = 404
        this.body = { status: false, message: 'School not found' }
        return
    }

    if (state !== 'accommodation-confirmed' && access !== 'admin') {
        this.status = 412
        this.body = { status: false, message: 'School not eligible for billing' }
        return
    }

    const ACCOMMODATION_PRICE = yield getAccommodationPrice(r)
    let committeeBill = getCommitteeBill(committee, COMMITTEE_PRICE)
    let accommodationBill = getAccommodationBill(reservations, ACCOMMODATION_PRICE)

    this.status = 200
    this.body = {
        committee: committeeBill,
        accommodation: accommodationBill,
        total: committeeBill + accommodationBill,
        detail: detail ? {
            committee: getCommitteeBillingEntries(committee, COMMITTEE_PRICE),
            accommodation: getAccommodationBillingEntries( reservations, ACCOMMODATION_PRICE, yield getAccommodationName(r) )
        } : null
    }
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

        let {inserted, replaced, unchanged} = yield r.table('payment').insert({
            id: schoolId,
            mime,
            buffer: yield readFile(path)
        }, {
            conflict: 'update'
        })

        if (!inserted && !replaced && !unchanged) {
            this.status = 500
            this.body = { status: false, message: 'Internal Error during db insertion' }
            return
        }

        yield r.table('enroll').get(schoolId).update({ state: 'paid' })

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
        this.body = yield r.table('payment').filter(
            r.not( r.row('state').default('').eq('accepted') )
        ).pluck('id', 'state')
    },
    GetPaymentCredential: function* Handler_Get_PaymentCredential() {
        const {mock, r} = this
        let schoolId = this.params.id
        if (mock) {
            this.status = 204
            return
        }
        
        let {mime, buffer} = yield r.table('payment').get(schoolId)
        if (!buffer) {
            this.status = 404
            return
        }

        this.status = 200
        this.set('Content-Type', mime)
        this.body = buffer
    },
    PostReview: function* Handler_Post_PaymentReview() {
        const {mock, r} = this
        const {id} = this.params
        let {accept, reject, amount} = this.is('multipart') ? this.request.body.fields : this.request.body

        if ( (accept && reject) || (!accept && !reject) ) {
            this.status = 400
            this.body = { status: false, message: 'Can not accept and reject at the same time' }
            return
        }

        if (accept) {
            if (!mock) {
                yield r.table('payment').get(id).update({ state: 'accepted', timestamp: r.now().toEpochTime() })
                yield r.table('enroll').get(id).update({ state: 'payment-confirmed', paidAmount: accept })
            }
            this.status = 200
            this.body = { status: true, message: 'Payment verified' }
        }

        if (reject) {
            if (!mock) {
                yield r.table('payment').get(id).update({ state: 'rejected', timestamp: r.now().toEpochTime(), reason: reject })
                yield r.table('enroll').get(id).update({ state: 'accommodation-confirmed' })
            }
            this.status = 200
            this.body = { status: true, message: 'Payment rejected' }
        }
    }
}