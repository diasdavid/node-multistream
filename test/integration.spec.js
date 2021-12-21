'use strict'
/* eslint-env mocha */

const { expect } = require('aegir/utils/chai')
const pipe = require('it-pipe')
const { collect } = require('streaming-iterables')
const BufferList = require('bl/BufferList')
const DuplexPair = require('it-pair/duplex')
const randomBytes = require('./helpers/random-bytes')
const MSS = require('../')

describe('Dialer and Listener integration', () => {
  it('should handle and select', async () => {
    const protocols = ['/echo/2.0.0', '/echo/1.0.0']
    const selectedProtocol = protocols[protocols.length - 1]
    const pair = DuplexPair()

    const dialer = new MSS.Dialer(pair[0])
    const listener = new MSS.Listener(pair[1])

    const [dialerSelection, listenerSelection] = await Promise.all([
      dialer.select(protocols),
      listener.handle(selectedProtocol)
    ])

    expect(dialerSelection.protocol).to.equal(selectedProtocol)
    expect(listenerSelection.protocol).to.equal(selectedProtocol)

    // Ensure stream is usable after selection
    const input = [randomBytes(10), randomBytes(64), randomBytes(3)]
    const output = await Promise.all([
      pipe(input, dialerSelection.stream, collect),
      pipe(listenerSelection.stream, listenerSelection.stream)
    ])
    expect(BufferList(output[0]).slice()).to.eql(BufferList(input).slice())
  })

  it('should handle, ls and select', async () => {
    const protocols = ['/echo/2.0.0', '/echo/1.0.0']
    const selectedProtocol = protocols[protocols.length - 1]
    const pair = DuplexPair()

    const dialer = new MSS.Dialer(pair[0])
    const listener = new MSS.Listener(pair[1])

    const [listenerSelection, dialerSelection] = await Promise.all([
      listener.handle(selectedProtocol),
      (async () => {
        const listenerProtocols = await dialer.ls(protocols)
        expect(listenerProtocols).to.eql([selectedProtocol])
        return dialer.select(selectedProtocol)
      })()
    ])

    expect(dialerSelection.protocol).to.equal(selectedProtocol)
    expect(listenerSelection.protocol).to.equal(selectedProtocol)

    // Ensure stream is usable after selection
    const input = [randomBytes(10), randomBytes(64), randomBytes(3)]
    const output = await Promise.all([
      pipe(input, dialerSelection.stream, collect),
      pipe(listenerSelection.stream, listenerSelection.stream)
    ])
    expect(BufferList(output[0]).slice()).to.eql(BufferList(input).slice())
  })
})
