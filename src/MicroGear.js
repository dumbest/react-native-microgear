'use strict';

import {Client, Message} from 'react-native-paho-mqtt';
import * as CMMC from '../../react-native-netpie-auth'
let CMMC_EventEmitter = require("./CMMC_EventEmitter")

//Set up an in-memory alternative to global localStorage
const myStorage = {
  setItem: (key, item) => {
    myStorage[key] = item;
  },
  getItem: (key) => myStorage[key],
  removeItem: (key) => {
    delete myStorage[key];
  },
};

class MicroGearEventEmitter extends CMMC_EventEmitter {

}

type Payload = string | Uint8Array;

class MicroGear {
  appid = ''
  appkey = ''
  appsecret = ''
  prefix = ''
  mqtt = {}

  events = MicroGearEventEmitter.instance

  constructor (config) {
    this.appid = config.appid
    this.appkey = config.key
    this.appsecret = config.secret
    this.alias = config.alias
    this.ws_port = config.port || 8083
  }

  static create (config) {
    return new MicroGear(config);
  }

  on (eventName: string, callback: () => void) {
    this.events.addListener(eventName, callback)
  }

  isConnected() {
    return this.client.isConnected()
  }

  subscribe (topic: string) {
    let t = `${this.mqtt.prefix}/${topic}`
    return this.client.subscribe(t)
  }


  publish (topic: string, payload: Payload, retain = false, qos = 0) {
    const message = new Message(payload);
    // message.retain = retain
    // message.qos = qos
    message.destinationName = `${this.mqtt.prefix}/${topic}`;
    this.client.send(message);
    // console.log(this.client.getTraceLog())
  }

  connect (appid) {
    this.appid = appid

    console.log('appid ', this.appid)
    console.log('appkey', this.appkey)
    console.log('appsecret', this.appsecret)

    this.netpie_auth = new CMMC.NetpieAuth({
      appid: this.appid,
      appkey: this.appkey,
      appsecret: this.appsecret,
      verifier: this.alias
    });

    this.netpie_auth.events.on("ready", () => {
      this.netpie_auth.getMqttAuth((mqtt) => {
        Object.assign(this.mqtt, mqtt);
        this.prefix = this.mqtt.prefix
        this.client = new Client({
          uri: `ws://${this.mqtt.host}:${this.ws_port}/`, clientId: this.mqtt.client_id, storage: myStorage
        });


        // set event handlers
        this.client.on('connectionLost', (responseObject) => {
          if (responseObject.errorCode !== 0) {
            console.log(responseObject.errorMessage);
          }
          MicroGearEventEmitter.syncEmit("closed", responseObject)
        });

        this.client.on('messageReceived', (message) => {
          MicroGearEventEmitter.syncEmit("message", message)
        });

        this.client.connect({
          cleanSession: true,
          userName: `${mqtt.username}`,
          password: mqtt.password,
          useSSL: false
        }).then((...args) => {
          MicroGearEventEmitter.syncEmit("connected", ...args)
        });


      });
    });

  }

}
module.exports = MicroGear;