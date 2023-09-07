require('dotenv').config();
const express = require("express");
const morgan = require('morgan');
const cors = require('cors');
const {startup} = require('./startup')
const {getDevicePowerStates} = require('./utils')
const {authenticator} = require('otplib')

const wg_host = process.env.WG_HOST || 'localhost'
const wg_port = process.env.WG_PORT || '8989'

const app = express();
app.use(express.json());
app.use(express.urlencoded({extended: false}))
app.use(morgan('combined'))
app.use(cors({
    origin: [process.env.LOCAL_DEVELOPMENT_FRONTEND_URL, process.env.PROD_FRONTEND_URL]
}))

const startServer = async () => {
    const {deviceInfo, devices} = await startup()

    app.get('/healthcheck', async (req, res) => {
        res.json({health: 'y'})
    })

    app.get('/', async (req, res) => {
        res.send(await getDevicePowerStates(devices))
    })

    app.post('/validateTotp', async (req, res) => {
        res.json({
            totp: {
                token: req.body.totp, valid: authenticator.check(req.body.totp, process.env.TOTP_SECRET)
            },
        })
    })

    app.post('/submit', async (req, res) => {
        let targetedDevices = new Set()
        let powerState = req.body.powerState

        if (!authenticator.check(req.body.totp.token, process.env.TOTP_SECRET)) {
            return res.status(404).send()
        }

        if (req.body.hosts) {
            console.log(req.body.hosts)
            devices.filter(i => req.body.hosts.includes(i.host))
                .map(i => targetedDevices.add(i))
        }
        if (req.body.zones) {
            console.log(req.body.zones)
            devices.filter(i => req.body.zones.includes(i.aliasMetadata.zone))
                .map(i => targetedDevices.add(i))
        }

        try {
            await Promise.all(Array.from(targetedDevices).map(async i => {
                await i.setPowerState(powerState)
            }))
        } catch (err) {
            console.error('ERR', err)
        }


        res.json(await getDevicePowerStates(devices))
    })

    app.listen(wg_port, wg_host, () => {
        console.log(`app listening on ${wg_host}:${wg_port}`)
    })
}

startServer()
