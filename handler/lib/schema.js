'use strict'

const re_date = /(\d{4})-(\d{2})-(\d{2})/

module.exports = {
    isReservation($) {
        try {
            return $.id
                && String($.checkIn).match(re_date)
                && String($.checkOut).match(re_date)
        } catch(e) {
            return false
        }
    }
}
