'use strict'

const {strictEqual} = require('assert')
const server = require('../server')
const request = require('request')

const OPTS = {
    mock: true,
    port: 0,
    host: '127.0.0.1',
    accessLog: undefined,
    log: undefined
}

describe('jwt login', function() {
    let app, port, token
    let URL
    before( function(next){
        app = server.create(OPTS)
        app.on('listening', ()=>{
            port = app.address().port
            URL = 'http://127.0.0.1:'+port+'/login'
            next()
        })
    } )

    it('POST: correct login', function(done) {
        request.post({
            url:  URL,
            json: true,
            body: {
                user: 'ok',
                password: 'ok'
            }
        }, (err, res, body)=>{
            strictEqual(200, res.statusCode, 'status = 401')
            let {id, access} = body.cred
            strictEqual(id, 'mock_admin')
            strictEqual(access, 'admin')
            token = body.token
            done()
        })
    })

    it('POST: incorrect login', function(done) {
        request.post({
            url:  URL,
            json: true,
            body: {
                user: 'incorrect',
                password: 'incorrect'
            }
        }, (err, res, body)=>{
            strictEqual(403, res.statusCode, 'status = 403')
            done()
        })
    })

    it('GET: checks valid token => 200', function(done) {
        request.get({
            url:  URL,
            json: true,
            headers: {
                'Authorization': 'Bearer '+token
            }
        }, (err, res, body)=>{
            strictEqual(200, res.statusCode, 'status = 200')
            strictEqual(body.status, true)
            done()
        })
    })

    it('GET: checks invalid token => 401', function(done) {
        request.get({
            url:  URL,
            json: true 
        }, (err, res, body)=>{
            strictEqual(401, res.statusCode, 'status = 401')
            strictEqual(body.status, false)
            done()
        })
    })

    after(function(done) {
        app.close()
        done()
    })
})