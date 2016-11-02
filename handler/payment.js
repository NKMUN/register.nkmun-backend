'use strict'

const COMMITTEE_PRICE = {
    "loc_absent_leader": 350,
    "loc_observer": 350,
    "*": 750
}

function differenceOfDays(a, b) {
    return Math.round( (new Date(a) - new Date(b)) / (24*3600*1000) )
}

function getCommitteeBill(committee, PRICE) {
    let sum = 0
    for (let c in committee)
        sum += (PRICE[c] || PRICE['*']) * committee[c]
    return sum
}

function getAccommodationBill(reservations, PRICE) {
    return reservations.map( ({accommodation, checkIn, checkOut, amount=1}) =>
           (PRICE[accommodation]!==undefined ? PRICE[accommodation] : PRICE['*'])
         * amount
         * differenceOfDays(checkOut, checkIn)
    ).reduce( (l,r) => l+r )
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

    if (state !== 'accommodation-confirmed') {
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
        const data = this.is('multipart') ? this.request.body.fields : this.request.body

        console.log(this.request.body)
    },
    Get: function* Handler_Get_Billing() {
        let { school: schoolId } = this.token
        yield respondWithSchoolBilling.call(this, schoolId, true)
    },
    GetId: function* Handler_Get_BillingId() {
        let schoolId = this.params.id
        yield respondWithSchoolBilling.call(this, schoolId)
    }
}