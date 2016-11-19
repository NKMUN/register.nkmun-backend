'use strict'

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

function* getAccommodationPrice(r, table) {
    return yield r.table(table)
                 .fold(
                     {'*': null},
                     (acc, $) => acc.merge( r.object( $('id'), $('price') ) )
                 )
}

function getBillingJSON({ committee, reservations, committeePrice, accommodationPrice }) {
    let committeeBill = getCommitteeBill(committee, committeePrice)
    let accommodationBill = getAccommodationBill(reservations, accommodationPrice)
    return {
        committee: committeeBill,
        accommodation: accommodationBill,
        total: committeeBill + accommodationBill
    }
}

module.exports = {
    getCommitteeBill,
    getAccommodationBill,
    // getCommitteeBillingEntries,
    // getAccommodationBillingEntries,
    getAccommodationPrice,
    getBillingJSON
}
