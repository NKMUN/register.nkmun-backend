'use strict'

const { MOCK_ACCOMMODATION } = require('../mock-data')

module.exports = {
    Get: function* Handler_Get_Accommodation() {
        const {mock, r} = this
        this.status = 200
        this.body = mock
                  ? MOCK_ACCOMMODATION
                  : yield r.table('accommodation').orderBy({index: 'id'}).pluck('id', 'name', 'type', 'stock')
    },
    Post: function* Handler_Post_AccommodationReservation() {
        const {mock, r} = this
        const {school: schoolId} = this.token

        // check school state is valid
        let currentState = mock
                         ? 'quota-confirmed'
                         : yield r.table('enroll').get(schoolId).default({}).getField('state')

        if (currentState !== 'quota-confirmed') {
            this.status = 409
            this.body = { status: false, message: 'Invalid state to reserve accommodation' }
            return
        }
        
        // verify, aggregate
        let reservations = (this.is('multipart') ? this.request.body.fields : this.request.body).reservations
        if ( ! reservations.every( $ => $.id && $.checkIn && $.checkOut ) ) {
            this.status = 400
            this.body = { status: false, message: 'Invalid reservations' }
            return
        }

        if (mock) {
            this.status = 200
            this.body = { status: true }
            return
        }

        let query_checkReduceStock = reservations.map( $ => ({
            id: $.id,
            query: r.table('accommodation').get($.id).update( $ =>
                       r.branch( $('stock').gt(0), { stock: $('stock').sub(1) }, {} )
                   )
        }) )

        let failed, query_restore = [] 

        // check & sub stock amount
        for (let {id, query, amount = 1} of query_checkReduceStock) {
            let { replaced, skipped, unchanged } = yield query
            if (skipped) {
                failed = true
                this.status = 400
                this.body = { status: false, message: 'Invalid accommodation id' }
                break
            }
            if (unchanged) {
                failed = true
                this.status = 410
                this.body = { status: false, message: 'Insufficient stock' }
                break
            }
            if (replaced)
                query_restore.push( r.table('accommodation').get(id).update({ stock: r.row('stock').add(amount) }) )
        }

        // if fail, restore reduced stock
        if ( failed ) {
            for (let query of query_restore)
                yield query
            return
        }

        // batch insert into reservation table
        let { inserted } = yield r.table('reservation').insert(
            reservations.map( ({id, checkIn, checkOut}) => ({accommodation: id, checkIn, checkOut, school: schoolId}) )
        )

        if (inserted === reservations.length) {
            yield r.table('enroll').get(schoolId).update({ state: 'accommodation-confirmed' })
            this.status = 200
            this.body = { status: true, message: 'Accommodation Reserved' }
        } else {
            this.status = 500
            this.body = { status: null, message: 'Internal Error, Batch Insertion Failed' }
        }
    }
}