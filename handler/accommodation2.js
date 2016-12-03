'use strict'

const { MOCK_ACCOMMODATION } = require('../mock-data')
const { isReservation } = require('./lib/schema')

module.exports = {
    GetReservation: function* Handler_Get_Reservation() {
        const {mock, r} = this
        let schoolId = (this.params.id ? this.params.id : this.token.school) || ''
        this.status = 200
        this.body = mock
                  ? []
                  : yield r.table('reservation2').getAll(schoolId, {index: 'school'})
                          .eqJoin('accommodation', r.db('nkmun').table('accommodation'))
                          .without({ left: ['accommodation'], right: ['id', 'quota', 'stock', 'price'] })
                          .zip()
    },
    Post: function* Handler_Post_AccommodationReservation() {
        const {mock, r} = this
        const {school: schoolId} = this.token

        // check school state is valid
        let currentState = mock
                         ? 'stage-2'
                         : yield r.table('enroll').get(schoolId).default({}).getField('state')

        if (currentState !== 'stage-2') {
            this.status = 409
            this.body = { status: false, message: 'Invalid state to reserve accommodation' }
            return
        }

        // verify, aggregate
        let { reservations } = this.is('multipart') ? this.request.body.fields : this.request.body
        if ( ! reservations.every( isReservation ) ) {
            this.status = 400
            this.body = { status: false, message: 'Invalid reservations' }
            return
        }

        if (mock) {
            this.status = 200
            this.body = { status: true }
            return
        }

        let queries = reservations.map( ({id, amount = 1}) => ({
            restore: r.table('accommodation').get(id).update({ stock: r.row('stock').add( amount ) }),
            update:  r.table('accommodation').get(id).update( $ =>
                         r.branch( $('stock').ge( amount ), { stock: $('stock').sub( amount ) }, {} )
                     )
        }))

        let failed, queryRestore = []

        // check & sub stock amount
        for (let {update, restore} of queries) {
            let { replaced, skipped, unchanged } = yield update
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
                queryRestore.push( restore )
        }

        // if fail, restore reduced stock
        if ( failed ) {
            for (let restore of queryRestore)
                yield restore
            return
        }

        // batch insert into reservation table
        let { inserted } = yield r.table('reservation2').insert(
            reservations.map( ({id, checkIn, checkOut}) => ({accommodation: id, checkIn, checkOut, school: schoolId}) )
        )

        if (inserted === reservations.length) {
            yield r.table('enroll').get(schoolId).update({ state: 'accommodation-confirmed-2' })
            this.status = 200
            this.body = { status: true, message: 'Accommodation Reserved' }
        } else {
            this.status = 500
            this.body = { status: null, message: 'Internal Error, Batch Insertion Failed' }
        }
    }
}
