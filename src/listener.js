'use strict'

const lp = require('pull-length-prefixed')
const pull = require('pull-stream')
const varint = require('varint')
const isFunction = require('lodash.isfunction')
const assert = require('assert')
const debug = require('debug')
const log = debug('libp2p:multistream:listener')
const Connection = require('interface-connection').Connection

const PROTOCOL_ID = require('./constants').PROTOCOL_ID
const agrmt = require('./agreement')

module.exports = class Listener {
  constructor () {
    this.handlers = {
      ls: (conn) => this._ls(conn)
    }
  }

  // perform the multistream handshake
  handle (rawConn, callback) {
    log('handling connection')

    const selectStream = agrmt.select(PROTOCOL_ID, (err, conn) => {
      if (err) {
        return callback(err)
      }

      const hsConn = new Connection(conn, rawConn)

      const handlerSelector = agrmt.handlerSelector(hsConn, this.handlers)

      pull(
        hsConn,
        handlerSelector,
        hsConn
      )

      callback()
    })

    pull(
      rawConn,
      selectStream,
      rawConn
    )
  }

  // be ready for a given `protocol`
  addHandler (protocol, handler) {
    log('handling %s', protocol)

    assert(isFunction(handler), 'handler must be a function')

    if (this.handlers[protocol]) {
      log('overwriting handler for %s', protocol)
    }

    this.handlers[protocol] = handler
  }

  // inner function - handler for `ls`
  _ls (conn) {
    const protos = Object.keys(this.handlers)
      .filter((key) => key !== 'ls')
    const nProtos = protos.length
    // total size of the list of protocols, including varint and newline
    const size = protos.reduce((size, proto) => {
      const p = new Buffer(proto + '\n')
      const el = varint.encodingLength(p.length)
      return size + el
    }, 0)

    const buf = Buffer.concat([
      new Buffer(varint.encode(nProtos)),
      new Buffer(varint.encode(size)),
      new Buffer('\n')
    ])

    const encodedProtos = protos.map((proto) => {
      return new Buffer(proto + '\n')
    })
    const values = [buf].concat(encodedProtos)

    pull(
      pull.values(values),
      lp.encode(),
      conn
    )
  }
}
