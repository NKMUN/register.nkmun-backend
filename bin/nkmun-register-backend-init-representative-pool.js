#!/usr/bin/env node

'use strict'

const program = require('commander')
const r = require('rethinkdb')
const co = require('co')
const {derive} = require('../lib/password-util')

const REPR_POOL = {
    loc_biz: 70,
    loc_cn_1: 120,
    loc_cn_2: 60,
    loc_cn_3: 66,
    loc_cn_4: 85,
    loc_cs_1: 67,
    loc_cs_2: 67,
    loc_cs_3: 67,
    loc_en_1: 40,
    loc_en_2: 80,
    loc_en_3: 100,
    loc_en_4: 100,
    loc_en_5: 100,
    loc_media: 60,
    loc_observer: 40,
    loc_superv: 60
}

program
    .version('0.1.0')
    .usage('[options]')
    .option('--mock', 'Run in mock mode')
    .option('--db-host [host], Database host, default 127.0.0.1')
    .option('--db-port [port], Database port, default 28015', parseInt)
    .parse(process.argv)

const {
    mock = false,
    dbHost = '127.0.0.1',
    dbPort = 28015,
    dbName = 'nkmun'
} = program


co( function*() {
    let conn = yield r.connect({
        host: dbHost,
        port: dbPort,
        db:   dbName
    })

    let count = yield r.table('representative').count().run(conn)

    if (count>0) {
        process.stderr.write(`<!> representative table is not empty! abort!\n`)
        process.exit(1)
        return
    }

    for (let k in REPR_POOL) {
        let reprs = '1'.repeat(REPR_POOL[k]).split('').map( $ => ({ committee: k }))
        let {inserted} = yield r.table('representative').insert(reprs).run(conn)
        process.stderr.write(`Add ${inserted} of ${k} to representative pool\n`)
    }
})
.then( () => process.exit(0) )
.catch( (err) => {
    console.log(err.stack)
    process.stderr.write(err.message+'\n')
})
