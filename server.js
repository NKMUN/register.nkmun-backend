'use strict'

const Router = require('koa-router')
const {get, post} = require('koa-router')
const {resolve} = require('path')
const {createServer} = require('http')
const winston = require('winston')
const {info, warn, error} = require('winston')
const {red, blue, green} = require('chalk')
const accesslog = require('koa-accesslog')
const koaBody = require('koa-body')
const devNull = require('dev-null')

const Handler = require('./handler')

const dbHost = '192.168.1.77'
const dbPort = 28015
const JWT_SECRET = 'jwt-secret'

function createDBConnection(dbHost, dbPort) {
    return require('rethinkdbdash')({
        host:   dbHost,
        port:   dbPort,
        db:     'register-nkmun',
        pool:   true,
        max:    5,
        cursor: false
    })
}

function createApp({ mock, accessLog, dbHost, dbPort=28015}) {
    const app = require('koa')()

    app.context.JWT_SECRET = JWT_SECRET 
    app.context.mock = mock
    if (mock)
        warn(red('Running in mock mode'))
    if (!mock)
        app.context.r = createDBConnection(dbHost, dbPort)
    app.on('error', function(err) {
        error(err.message)
        error(err.stack)
        if ( err.message.indexOf('REQLDriver') ) {
            // reset db connection
            app.context.r = createDBConnection(dhHost, dbPort)
        }
    })

    app.use( accesslog(accessLog) )
    app.use( koaBody({ multipart: true }) )

    // Public Router
    let publics = new Router()
    publics.post('/reset',  Handler.Reset.Post)
    publics.post('/enroll', Handler.Enroll.Post)
    publics.get( '/login',  Handler.Login.Router, Handler.Login.Get)
    publics.post('/login',  Handler.Login.Post)

    // Admin Router
    let admins = new Router()
    admins.use( Handler.Login.Router )
    admins.use( Handler.Login.HasAccess('admin') )
    admins.get( '/enroll',     Handler.Enroll.Get )
    admins.get( '/enroll/:id', Handler.Enroll.GetId )
    admins.post('/enroll/:id', Handler.Enroll.PostId )

    app.use( publics.routes() )
    app.use( admins.routes() ) 

    return app
}

module.exports = {
    create({ mock = false, port = 8001, host, accessLog, log }) {
        winston.add( winston.transports.File, {
            colorize: log === process.stdout,
            json:     false,
            stream:   log ? log : devNull()
        })
        winston.remove( winston.transports.Console )

        let app = createApp({
            accessLog: accessLog ? accessLog: devNull(),
            mock,
            dbHost,
            dbPort
        })

        let server = createServer( app.callback() )
                     .listen(port, host, ()=>{
                         let {address, port, family} = server.address()
                         if (family === 'IPv6')
                             address = `[${address}]`
                         info(`Server listening on: ${blue(`${address}:${port}`)}`)
                     })

        return server
    }
}