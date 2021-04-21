'use strict';

/**
 * Documentation of 'meta'
 *
 * configureKey: required when a 'configure' is defined, this key is used by the application to determine if the
 *               content of the configure has been changed and thus needs to re-execute it. For a currently
 *               unsupported device you can set this to 1.
 * multiEndpoint: enables the multi endpoint functionallity in e.g. fromZigbee.on_off, example: normally this
 *                converter would return {"state": "OFF"}, when multiEndpoint is enabled the 'endpoint' method
 *                of the device definition will be called to determine the endpoint name which is then used as
 *                key e.g. {"state_left": "OFF"}. Only needed when device sends the same attribute from
 *                multiple endpoints.
 * disableDefaultResponse: used by toZigbee converters to disable the default response of some devices as they
 *                         don't provide one.
 * applyRedFix: see toZigbee.light_color
 * enhancedHue: see toZigbee.light_color
 * supportsHueAndSaturation: see toZigbee.light_color
 * timeout: timeout for commands to this device used in toZigbee.
 * coverInverted: Set to true for cover controls that report position=100 as open
 * turnsOffAtBrightness1: Indicates light turns off when brightness 1 is set
 * pinCodeCount: Amount of pincodes the lock can handle
 * disableActionGroup: Prevents some converters adding the action_group to the payload
 * tuyaThermostatSystemMode/tuyaThermostatPreset: TuYa specific thermostat options
 * thermostat: see e.g. HT-08 definition
 * battery:
 *    {dontDividePercentage: true}: prevents batteryPercentageRemainig from being divided (ZCL 200=100%, but some report 100=100%)
 *    {voltageToPercentage: '3V_2100'}: convert voltage to percentage using specified option. See utils.batteryVoltageToPercentage()
 */

const assert = require('assert');
const fz = {...require('./converters/fromZigbee'), legacy: require('./lib/legacy').fromZigbee};
const tz = require('./converters/toZigbee');
const globalStore = require('./lib/store');
const ota = require('./lib/ota');
const exposes = require('./lib/exposes');
const tuya = require('./lib/tuya');
const ikea = require('./lib/ikea');
const constants = require('./lib/constants');
const livolo = require('./lib/livolo');
const legrand = require('./lib/legrand');
const xiaomi = require('./lib/xiaomi');
const {repInterval, defaultBindGroup, OneJanuary2000} = require('./lib/constants');
const reporting = require('./lib/reporting');
const preset = require('./lib/presets');

const e = exposes.presets;
const ea = exposes.access;

const devices = [
    // Xiaomi
    ...require('./devices/xiaomi'),

    // TuYa
    ...require('./devices/tuya'),

    // UseeLink
    {
        fingerprint: [{modelID: 'TS011F', manufacturerName: '_TZ3000_o005nuxx'}],
        model: 'SM-SO306EZ-10',
        vendor: 'UseeLink',
        description: '4 gang switch, with USB',
        exposes: [e.switch().withEndpoint('l1'), e.switch().withEndpoint('l2'), e.switch().withEndpoint('l3'),
            e.switch().withEndpoint('l4'), e.switch().withEndpoint('l5')],
        extend: preset.switch(),
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            for (const ID of [1, 2, 3, 4, 5]) {
                await reporting.bind(device.getEndpoint(ID), coordinatorEndpoint, ['genOnOff']);
            }
        },
        endpoint: (device) => {
            return {'l1': 1, 'l2': 2, 'l3': 3, 'l4': 4, 'l5': 5};
        },
    },
    {
        fingerprint: [{modelID: 'TS011F', manufacturerName: '_TZ3000_tvuarksa'}],
        model: 'SM-AZ713',
        vendor: 'UseeLink',
        description: 'Smart water/gas valve',
        extend: preset.switch(),
    },

    // Mycket
    {
        fingerprint: [{modelID: 'TS0505A', manufacturerName: '_TZ3000_evag0pvn'}],
        model: 'MS-SP-LE27WRGB',
        description: 'E27 RGBW bulb',
        vendor: 'Mycket',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },

    // Brimate
    {
        zigbeeModel: ['FB56-BOT02HM1A5'],
        model: 'FZB8708HD-S1',
        vendor: 'Brimate',
        description: 'Smart motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low()],
    },

    // Neo
    {
        fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_d0yu2xgi'}],
        zigbeeModel: ['0yu2xgi'],
        model: 'NAS-AB02B0',
        vendor: 'Neo',
        description: 'Temperature & humidity sensor and alarm',
        fromZigbee: [fz.neo_t_h_alarm, fz.ignore_basic_report],
        toZigbee: [tz.neo_t_h_alarm],
        exposes: [
            e.temperature(), e.humidity(), exposes.binary('humidity_alarm', ea.STATE_SET, true, false), e.battery_low(),
            exposes.binary('temperature_alarm', ea.STATE_SET, true, false),
            exposes.binary('alarm', ea.STATE_SET, true, false),
            exposes.enum('melody', ea.STATE_SET, Array.from(Array(18).keys()).map((x)=>(x+1).toString())),
            exposes.numeric('duration', ea.STATE_SET).withUnit('second'),
            exposes.numeric('temperature_min', ea.STATE_SET).withUnit('°C'),
            exposes.numeric('temperature_max', ea.STATE_SET).withUnit('°C'),
            exposes.numeric('humidity_min', ea.STATE_SET).withUnit('%'),
            exposes.numeric('humidity_max', ea.STATE_SET).withUnit('%'),
            exposes.enum('volume', ea.STATE_SET, ['low', 'medium', 'high']),
            exposes.enum('power_type', ea.STATE, ['battery_full', 'battery_high', 'battery_medium', 'battery_low', 'usb']),
        ],
    },

    // Lonsonho
    ...require('./devices/lonsonho'),

    // IKEA
    ...require('./devices/ikea'),

    // Philips
    ...require('./devices/philips'),

    // Belkin
    {
        zigbeeModel: ['MZ100'],
        model: 'F7C033',
        vendor: 'Belkin',
        description: 'WeMo smart LED bulb',
        extend: preset.light_onoff_brightness(),
    },

    // EDP
    {
        zigbeeModel: ['ZB-SmartPlug-1.0.0'],
        model: 'PLUG EDP RE:DY',
        vendor: 'EDP',
        description: 're:dy plug',
        fromZigbee: [fz.on_off, fz.metering],
        toZigbee: [tz.on_off],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(85);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.instantaneousDemand(endpoint);
        },
        exposes: [e.switch(), e.power(), e.energy()],
    },
    {
        zigbeeModel: ['ZB-RelayControl-1.0.0'],
        model: 'SWITCH EDP RE:DY',
        vendor: 'EDP',
        description: 're:dy switch',
        extend: preset.switch(),
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(85);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // Custom devices (DiY)
    ...require('./devices/custom_devices_diy'),

    // OpenLumi
    {
        zigbeeModel: ['openlumi.gw_router.jn5169'],
        model: 'GWRJN5169',
        vendor: 'OpenLumi',
        description: '[Lumi Router (JN5169)](https://github.com/igo-r/Lumi-Router-JN5169)',
        fromZigbee: [fz.ignore_basic_report, fz.device_temperature],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genDeviceTempCfg']);
            await reporting.deviceTemperature(endpoint, {min: repInterval.MINUTE, max: repInterval.MINUTES_5});
        },
        exposes: [e.device_temperature()],
    },

    // databyte.ch
    {
        zigbeeModel: ['DTB190502A1'],
        model: 'DTB190502A1',
        vendor: 'databyte.ch',
        description: '[CC2530 based IO Board](https://databyte.ch/zigbee-dev-board-dtb190502a)',
        fromZigbee: [fz.DTB190502A1],
        toZigbee: [tz.DTB190502A1_LED],
        exposes: [exposes.binary('led_state', ea.STATE, 'ON', 'OFF'),
            exposes.enum('key_state', ea.STATE, ['KEY_SYS', 'KEY_UP', 'KEY_DOWN', 'KEY_NONE'])],
    },
    {
        zigbeeModel: ['DTB-ED2004-012'],
        model: 'ED2004-012',
        vendor: 'databyte.ch',
        description: 'Panda 1 - wall switch (https://databyte.ch/panda1-wallswitch-zigbee)',
        extend: preset.switch(),
    },

    // DIYRuZ
    ...require('./devices/diyruz'),

    // eCozy
    {
        zigbeeModel: ['Thermostat'],
        model: '1TST-EU',
        vendor: 'eCozy',
        description: 'Smart heating thermostat',
        fromZigbee: [fz.battery, fz.legacy.thermostat_att_report],
        toZigbee: [tz.factory_reset, tz.thermostat_local_temperature, tz.thermostat_local_temperature_calibration, tz.thermostat_occupancy,
            tz.thermostat_occupied_heating_setpoint, tz.thermostat_unoccupied_heating_setpoint, tz.thermostat_setpoint_raise_lower,
            tz.thermostat_remote_sensing, tz.thermostat_control_sequence_of_operation, tz.thermostat_system_mode,
            tz.thermostat_weekly_schedule, tz.thermostat_clear_weekly_schedule, tz.thermostat_relay_status_log,
            tz.thermostat_pi_heating_demand, tz.thermostat_running_state],
        exposes: [e.battery(), exposes.climate().withSetpoint('occupied_heating_setpoint', 7, 30, 1).withLocalTemperature()
            .withSystemMode(['off', 'auto', 'heat']).withRunningState(['idle', 'heat']).withLocalTemperatureCalibration()
            .withPiHeatingDemand(ea.STATE_GET)],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(3);
            const binds = ['genBasic', 'genPowerCfg', 'genIdentify', 'genTime', 'genPollCtrl', 'hvacThermostat', 'hvacUserInterfaceCfg'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.thermostatTemperature(endpoint);
        },
    },

    // GS
    {
        zigbeeModel: ['SSHM-I1'],
        model: 'SSHM-I1',
        vendor: 'GS',
        description: 'Smoke detector',
        fromZigbee: [fz.ias_smoke_alarm_1, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.smoke(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['BRHM8E27W70-I1'],
        model: 'BRHM8E27W70-I1',
        vendor: 'GS',
        description: 'Smart dimmable, RGB + white (E27 & B22)',
        extend: preset.light_onoff_brightness_color(),
    },

    // M-ELEC
    {
        zigbeeModel: ['ML-ST-D200'],
        model: 'ML-ST-D200',
        vendor: 'M-ELEC',
        description: 'Stitchy Dim switchable wall module',
        extend: preset.light_onoff_brightness(),
    },

    // OSRAM
    ...require('./devices/osram'),

    // Gewiss
    {
        zigbeeModel: ['GWA1521_Actuator_1_CH_PF'],
        model: 'GWA1521',
        description: 'Switch actuator 1 channel with input',
        vendor: 'Gewiss',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['GWA1522_Actuator_2_CH'],
        model: 'GWA1522',
        description: 'Switch actuator 2 channels with input',
        vendor: 'Gewiss',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('l1'), e.switch().withEndpoint('l2')],
        meta: {multiEndpoint: true},
        endpoint: (device) => {
            return {'l1': 1, 'l2': 2};
        },
    },
    {
        zigbeeModel: ['GWA1531_Shutter'],
        model: 'GWA1531',
        description: 'Shutter actuator',
        vendor: 'Gewiss',
        fromZigbee: [fz.cover_position_tilt, fz.ignore_basic_report],
        toZigbee: [tz.cover_state, tz.cover_position_tilt],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genLevelCtrl']);
            await reporting.brightness(endpoint);
        },
        exposes: [e.cover_position()],
    },

    // Ledvance
    {
        zigbeeModel: ['Panel TW Z3'],
        model: '4058075181472',
        vendor: 'LEDVANCE',
        description: 'SMART+ panel 60 x 60cm tunable white',
        extend: preset.ledvance.light_onoff_brightness_colortemp(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['Panel TW 620 UGR19'],
        model: 'GPDRPLOP401100CE',
        vendor: 'LEDVANCE',
        description: 'Panel TW LED 625 UGR19',
        extend: preset.ledvance.light_onoff_brightness_colortemp_color({colorTempRange: [153, 370]}),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['A60 RGBW Value II'],
        model: 'AC25697',
        vendor: 'LEDVANCE',
        description: 'SMART+ CLASSIC MULTICOLOUR 60 10W E27',
        extend: preset.ledvance.light_onoff_brightness_colortemp_color(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['PAR16 RGBW Value'],
        model: 'AC08560',
        vendor: 'LEDVANCE',
        description: 'SMART+ spot GU10 multicolor RGBW',
        extend: preset.ledvance.light_onoff_brightness_colortemp_color(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['B40 TW Z3'],
        model: '4058075208414',
        vendor: 'LEDVANCE',
        description: 'SMART+ candle E14 tunable white',
        extend: preset.ledvance.light_onoff_brightness_colortemp(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['FLEX RGBW Z3'],
        model: '4058075208339',
        vendor: 'LEDVANCE',
        description: 'Flex 3P multicolor',
        extend: preset.ledvance.light_onoff_brightness_colortemp_color(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['P40 TW Value'],
        model: '4058075485174',
        vendor: 'LEDVANCE',
        description: 'SMART+ Lighting - Classic E14 tunable white',
        extend: preset.ledvance.light_onoff_brightness_colortemp(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['LEDVANCE DIM'],
        model: '4058075208421',
        vendor: 'LEDVANCE',
        description: 'SMART+ candle E14 tunable white',
        extend: preset.ledvance.light_onoff_brightness(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['Undercabinet TW Z3'],
        model: '4058075173989',
        vendor: 'LEDVANCE',
        description: 'SMART+ indoor undercabinet light',
        extend: preset.ledvance.light_onoff_brightness_colortemp(),
        ota: ota.ledvance,
    },
    {
        zigbeeModel: ['Gardenpole Mini RGBW Z3'],
        model: '4058075208353',
        vendor: 'LEDVANCE',
        description: 'SMART+ gardenpole multicolour',
        extend: preset.ledvance.light_onoff_brightness_colortemp_color({colorTempRange: [153, 526]}),
        ota: ota.ledvance,
    },

    // Hive
    ...require('./devices/hive'),

    // Innr
    ...require('./devices/innr'),

    // Digi
    {
        fingerprint: [{type: 'Router', manufacturerID: 4126, endpoints: [
            {ID: 230, profileID: 49413, deviceID: 1, inputClusters: [], outputClusters: []},
            {ID: 232, profileID: 49413, deviceID: 1, inputClusters: [], outputClusters: []},
        ]}],
        model: 'XBee',
        description: 'Router',
        vendor: 'Digi',
        fromZigbee: [],
        toZigbee: [],
        exposes: [],
    },

    // KAMI
    {
        zigbeeModel: ['Z3ContactSensor'],
        model: 'N20',
        vendor: 'KAMI',
        description: 'Entry sensor',
        fromZigbee: [fz.KAMI_contact, fz.KAMI_occupancy],
        toZigbee: [],
        exposes: [e.contact(), e.occupancy()],
    },

    // Sylvania
    ...require('./devices/sylvania'),

    // Leviton
    {
        zigbeeModel: ['DL15S'],
        model: 'DL15S-1BZ',
        vendor: 'Leviton',
        description: 'Lumina RF 15A switch, 120/277V',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['DG6HD'],
        model: 'DG6HD-1BW',
        vendor: 'Leviton',
        description: 'Zigbee in-wall smart dimmer',
        extend: preset.light_onoff_brightness({disableEffect: true}),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['65A01-1'],
        model: 'RC-2000WH',
        vendor: 'Leviton',
        description: 'Omnistat2 wireless thermostat',
        fromZigbee: [fz.legacy.thermostat_att_report, fz.fan],
        toZigbee: [tz.factory_reset, tz.thermostat_local_temperature, tz.thermostat_local_temperature_calibration, tz.thermostat_occupancy,
            tz.thermostat_occupied_heating_setpoint, tz.thermostat_unoccupied_heating_setpoint, tz.thermostat_occupied_cooling_setpoint,
            tz.thermostat_unoccupied_cooling_setpoint, tz.thermostat_setpoint_raise_lower, tz.thermostat_remote_sensing,
            tz.thermostat_control_sequence_of_operation, tz.thermostat_system_mode, tz.thermostat_weekly_schedule,
            tz.thermostat_clear_weekly_schedule, tz.thermostat_relay_status_log, tz.thermostat_running_state,
            tz.thermostat_temperature_setpoint_hold, tz.thermostat_temperature_setpoint_hold_duration, tz.fan_mode],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(9);
            await reporting.bind(endpoint, coordinatorEndpoint, ['hvacThermostat', 'hvacFanCtrl']);
            await reporting.thermostatTemperature(endpoint);
            await reporting.thermostatSystemMode(endpoint);
            await reporting.thermostatOccupiedHeatingSetpoint(endpoint);
            await reporting.thermostatUnoccupiedHeatingSetpoint(endpoint);
            await reporting.thermostatOccupiedCoolingSetpoint(endpoint);
            await reporting.thermostatUnoccupiedCoolingSetpoint(endpoint);
            await reporting.fanMode(endpoint);
        },
        exposes: [
            exposes.climate().withSetpoint('occupied_heating_setpoint', 10, 30, 1).withLocalTemperature()
                .withSystemMode(['off', 'auto', 'heat', 'cool']).withRunningState(['idle', 'heat', 'cool'])
                .withFanMode(['auto', 'on', 'smart']).withSetpoint('occupied_cooling_setpoint', 10, 30, 1)
                .withLocalTemperatureCalibration().withPiHeatingDemand()],
    },

    // GE
    ...require('./devices/ge'),

    // Sengled
    ...require('./devices/sengled'),

    // Swann
    {
        zigbeeModel: ['SWO-KEF1PA'],
        model: 'SWO-KEF1PA',
        vendor: 'Swann',
        description: 'Key fob remote',
        fromZigbee: [fz.legacy.KEF1PA_arm, fz.command_panic],
        toZigbee: [],
        exposes: [e.action(['home', 'sleep', 'away', 'panic'])],
    },
    {
        zigbeeModel: ['SWO-WDS1PA'],
        model: 'SWO-WDS1PA',
        vendor: 'Swann',
        description: 'Window/door sensor',
        fromZigbee: [fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['SWO-MOS1PA'],
        model: 'SWO-MOS1PA',
        vendor: 'Swann',
        description: 'Motion and temperature sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low(), e.tamper()],
    },

    // JIAWEN
    {
        zigbeeModel: ['FB56-ZCW08KU1.1', 'FB56-ZCW08KU1.0'],
        model: 'K2RGBW01',
        vendor: 'JIAWEN',
        description: 'Wireless Bulb E27 9W RGBW',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['FB56-ZBW02KU1.5'],
        model: 'JW-A04-CT',
        vendor: 'JIAWEN',
        description: 'LED strip light controller',
        extend: preset.light_onoff_brightness(),
    },

    // Netvox
    {
        zigbeeModel: ['Z809AE3R'],
        model: 'Z809A',
        vendor: 'Netvox',
        description: 'Power socket with power consumption monitoring',
        fromZigbee: [fz.on_off, fz.electrical_measurement],
        toZigbee: [tz.on_off],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement']);
            await reporting.onOff(endpoint);
            await reporting.rmsVoltage(endpoint);
            await reporting.rmsCurrent(endpoint);
            await reporting.activePower(endpoint);
            await reporting.powerFactor(endpoint);
        },
        exposes: [e.switch(), e.power(), e.current(), e.voltage()],
    },

    // Nanoleaf
    {
        zigbeeModel: ['NL08-0800'],
        model: 'NL08-0800',
        vendor: 'Nanoleaf',
        description: 'Smart Ivy Bulb E27',
        extend: preset.light_onoff_brightness(),
    },

    // Nordtronic
    {
        zigbeeModel: ['BoxDIM2 98425031', '98425031', 'BoxDIMZ 98425031'],
        model: '98425031',
        vendor: 'Nordtronic',
        description: 'Box Dimmer 2.0',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['BoxRelayZ 98423051'],
        model: '98423051',
        vendor: 'Nordtronic',
        description: 'Zigbee switch 400W',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1) || device.getEndpoint(3);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // Nue, 3A
    ...require('./devices/nue_3a'),

    // Smart Home Pty
    {
        zigbeeModel: ['FB56-ZCW11HG1.2', 'FB56-ZCW11HG1.4', 'LXT56-LS27LX1.7'],
        model: 'HGZB-07A',
        vendor: 'Smart Home Pty',
        description: 'RGBW Downlight',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['FNB56-SKT1EHG1.2'],
        model: 'HGZB-20-DE',
        vendor: 'Smart Home Pty',
        description: 'Power plug',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['LXN56-1S27LX1.2'],
        model: 'NUE-ZBFLB',
        vendor: 'Nue / 3A',
        description: 'Smart fan light switch',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('button_light'), e.switch().withEndpoint('button_fan_high'),
            e.switch().withEndpoint('button_fan_med'), e.switch().withEndpoint('button_fan_low')],
        endpoint: (device) => {
            return {'button_light': 1, 'button_fan_high': 2, 'button_fan_med': 3, 'button_fan_low': 4};
        },
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(3), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(4), coordinatorEndpoint, ['genOnOff']);
        },
    },

    // Feibit
    ...require('./devices/feibit'),

    // Gledopto
    ...require('./devices/gledopto'),

    // YSRSAI
    {
        fingerprint: [{modelID: 'ZB-CL01', manufacturerName: 'YSRSAI'}],
        zigbeeModel: ['ZB-CL03', 'FB56-ZCW20FB1.2'],
        model: 'YSR-MINI-01_rgbcct',
        vendor: 'YSRSAI',
        description: 'Zigbee LED controller (RGB+CCT)',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['ZB-CT01'],
        model: 'YSR-MINI-01_wwcw',
        vendor: 'YSRSAI',
        description: 'Zigbee LED controller (WW/CW)',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['ZB-DL01'],
        model: 'YSR-MINI-01_dimmer',
        vendor: 'YSRSAI',
        description: 'Zigbee LED controller (Dimmer)',
        extend: preset.light_onoff_brightness(),
    },

    // Somgoms
    {
        zigbeeModel: ['tdtqgwv'],
        model: 'ZSTY-SM-11ZG-US-W',
        vendor: 'Somgoms',
        description: '1 gang switch',
        extend: preset.switch(),
        exposes: [e.switch().setAccess('state', ea.STATE_SET)],
        fromZigbee: [fz.tuya_switch, fz.ignore_time_read, fz.ignore_basic_report],
        toZigbee: [tz.tuya_switch_state],
    },
    {
        zigbeeModel: ['bordckq'],
        model: 'ZSTY-SM-1CTZG-US-W',
        vendor: 'Somgoms',
        description: 'Curtain switch',
        fromZigbee: [fz.tuya_cover, fz.ignore_basic_report],
        toZigbee: [tz.tuya_cover_control, tz.tuya_cover_options],
        exposes: [e.cover_position().setAccess('position', ea.STATE_SET)],
    },
    {
        zigbeeModel: ['hpb9yts'],
        model: 'ZSTY-SM-1DMZG-US-W',
        vendor: 'Somgoms',
        description: 'Dimmer switch',
        fromZigbee: [fz.tuya_dimmer, fz.ignore_basic_report],
        toZigbee: [tz.tuya_dimmer_state, tz.tuya_dimmer_level],
        exposes: [e.light_brightness().setAccess('state', ea.STATE_SET).setAccess('brightness', ea.STATE_SET)],
        extend: preset.light_onoff_brightness(),
    },

    // ROBB
    ...require('./devices/robb'),

    // Namron
    ...require('./devices/namron'),

    // SmartThings
    ...require('./devices/smartthings'),

    // Trust
    {
        zigbeeModel: ['WATER_TPV14'],
        model: 'ZWLD-100',
        vendor: 'Trust',
        description: 'Water leakage detector',
        fromZigbee: [fz.ias_water_leak_alarm_1, fz.ignore_basic_report, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.water_leak(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000'+
                      '\u0000\u0000\u0000\u0000\u0000', 'ZLL-NonColorController'],
        model: 'ZYCT-202',
        vendor: 'Trust',
        description: 'Remote control',
        fromZigbee: [fz.command_on, fz.command_off_with_effect, fz.legacy.ZYCT202_stop, fz.legacy.ZYCT202_up_down],
        exposes: [e.action(['on', 'off', 'stop', 'brightness_stop', 'brightness_move_up', 'brightness_move_down'])],
        toZigbee: [],
        // Device does not support battery: https://github.com/Koenkk/zigbee2mqtt/issues/5928
    },
    {
        zigbeeModel: ['ZLL-DimmableLigh'],
        model: 'ZLED-2709',
        vendor: 'Trust',
        description: 'Smart Dimmable LED Bulb',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['ZLL-ColorTempera', 'ZLL-ColorTemperature'],
        model: 'ZLED-TUNE9',
        vendor: 'Trust',
        description: 'Smart tunable LED bulb',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['VMS_ADUROLIGHT'],
        model: 'ZPIR-8000',
        vendor: 'Trust',
        description: 'Motion Sensor',
        fromZigbee: [fz.ias_occupancy_alarm_2, fz.battery, fz.ignore_basic_report],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.occupancy(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['CSW_ADUROLIGHT'],
        model: 'ZCTS-808',
        vendor: 'Trust',
        description: 'Wireless contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.battery, fz.ignore_basic_report],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },

    // Paulmann
    ...require('./devices/paulmann'),

    // Bitron
    ...require('./devices/bitron'),

    // Iris
    ...require('./devices/iris'),

    // ksentry
    {
        zigbeeModel: ['Lamp_01'],
        model: 'KS-SM001',
        vendor: 'Ksentry Electronics',
        description: '[Zigbee OnOff Controller](http://ksentry.manufacturer.globalsources.com/si/6008837134660'+
                     '/pdtl/ZigBee-module/1162731630/zigbee-on-off-controller-modules.htm)',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(11);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // Ninja Blocks
    {
        zigbeeModel: ['Ninja Smart Plug'],
        model: 'Z809AF',
        vendor: 'Ninja Blocks',
        description: 'Zigbee smart plug with power meter',
        fromZigbee: [fz.on_off, fz.metering],
        toZigbee: [tz.on_off],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.instantaneousDemand(endpoint);
        },
        exposes: [e.switch(), e.power(), e.energy()],
    },

    // Commercial Electric
    {
        zigbeeModel: ['Zigbee CCT Downlight'],
        model: '53170161',
        vendor: 'Commercial Electric',
        description: 'Matte White Recessed Retrofit Smart Led Downlight - 4 Inch',
        extend: preset.light_onoff_brightness_colortemp(),
    },

    // ilux
    {
        zigbeeModel: ['LEColorLight'],
        model: '900008-WW',
        vendor: 'ilux',
        description: 'Dimmable A60 E27 LED Bulb',
        extend: preset.light_onoff_brightness(),
    },

    // Dresden Elektronik
    {
        zigbeeModel: ['FLS-PP3'],
        model: 'Mega23M12',
        vendor: 'Dresden Elektronik',
        description: 'ZigBee Light Link wireless electronic ballast',
        extend: preset.light_onoff_brightness_colortemp_color(),
        ota: ota.zigbeeOTA,
        exposes: [e.light_brightness_colortemp_colorxy().withEndpoint('rgb'), e.light_brightness().withEndpoint('white')],
        endpoint: (device) => {
            return {rgb: 10, white: 11};
        },
    },
    {
        zigbeeModel: ['FLS-CT'],
        model: 'XVV-Mega23M12',
        vendor: 'Dresden Elektronik',
        description: 'ZigBee Light Link wireless electronic ballast color temperature',
        extend: preset.light_onoff_brightness_colortemp(),
    },

    // Centralite
    ...require('./devices/centralite'),

    // Xfinity
    {
        zigbeeModel: ['URC4450BC0-X-R'],
        model: 'URC4450BC0-X-R',
        vendor: 'Xfinity',
        description: 'Alarm security keypad',
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        fromZigbee: [fz.command_arm, fz.temperature, fz.battery, fz.ias_occupancy_alarm_1, fz.identify, fz.ias_contact_alarm_1,
            fz.ias_ace_occupancy_with_timeout],
        exposes: [e.battery(), e.battery_voltage(), e.occupancy(), e.battery_low(), e.tamper(), e.presence(), e.contact(),
            exposes.numeric('action_code', ea.STATE), exposes.text('action_zone', ea.STATE), e.temperature(), e.action([
                'disarm', 'arm_day_zones', 'identify', 'arm_night_zones', 'arm_all_zones', 'exit_delay', 'emergency',
            ])],
        toZigbee: [tz.arm_mode],
        configure: async (device, coordinatorEndpoint) => {
            const endpoint = device.getEndpoint(1);
            const clusters = ['msTemperatureMeasurement', 'genPowerCfg', 'ssIasZone', 'ssIasAce', 'genBasic', 'genIdentify'];
            await reporting.bind(endpoint, coordinatorEndpoint, clusters);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        onEvent: async (type, data, device) => {
            if (type === 'message' && data.type === 'commandGetPanelStatus' && data.cluster === 'ssIasAce' &&
                globalStore.hasValue(device.getEndpoint(1), 'panelStatus')) {
                const payload = {
                    panelstatus: globalStore.getValue(device.getEndpoint(1), 'panelStatus'),
                    secondsremain: 0x00, audiblenotif: 0x00, alarmstatus: 0x00,
                };
                await device.getEndpoint(1).commandResponse(
                    'ssIasAce', 'getPanelStatusRsp', payload, {}, data.meta.zclTransactionSequenceNumber,
                );
            }
        },
    },

    // Blaupunkt
    {
        zigbeeModel: ['SCM-2_00.00.03.15', 'SCM-R_00.00.03.15TC', 'SCM_00.00.03.14TC', 'SCM_00.00.03.05TC'],
        model: 'SCM-S1',
        vendor: 'Blaupunkt',
        description: 'Roller shutter',
        fromZigbee: [fz.cover_position_via_brightness, fz.cover_state_via_onoff],
        toZigbee: [tz.cover_via_brightness],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genLevelCtrl']);
            try {
                await reporting.brightness(endpoint);
            } catch (e) {
                // Some version don't support this: https://github.com/Koenkk/zigbee2mqtt/issues/4246
            }
        },
        exposes: [e.cover_position().setAccess('state', ea.ALL)],
    },

    // Lupus
    {
        zigbeeModel: ['SCM_00.00.03.11TC'],
        model: '12031',
        vendor: 'Lupus',
        description: 'Roller shutter',
        fromZigbee: [fz.cover_position_via_brightness, fz.cover_state_via_onoff],
        toZigbee: [tz.cover_via_brightness],
        exposes: [e.cover_position().setAccess('state', ea.ALL)],
    },
    {
        zigbeeModel: ['SCM-3-OTA_00.00.03.16TC'],
        model: 'LS12128',
        vendor: 'Lupus',
        description: 'Roller shutter',
        fromZigbee: [fz.cover_position_via_brightness, fz.cover_state_via_onoff],
        toZigbee: [tz.cover_via_brightness],
        exposes: [e.cover_position().setAccess('state', ea.ALL)],
    },
    {
        zigbeeModel: ['PSMP5_00.00.03.11TC'],
        model: '12050',
        vendor: 'Lupus',
        description: 'LUPUSEC mains socket with power meter',
        fromZigbee: [fz.on_off, fz.metering],
        exposes: [e.switch(), e.power()],
        toZigbee: [tz.on_off],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.instantaneousDemand(endpoint);
            endpoint.saveClusterAttributeKeyValue('seMetering', {divisor: 10, multiplier: 1});
        },
    },
    {
        zigbeeModel: ['PRS3CH1_00.00.05.10TC'],
        model: '12126',
        vendor: 'Lupus',
        description: '1 chanel relay',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
        },
    },
    {
        zigbeeModel: ['PRS3CH2_00.00.05.10TC', 'PRS3CH2_00.00.05.11TC'],
        model: '12127',
        vendor: 'Lupus',
        description: '2 chanel relay',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('l1'), e.switch().withEndpoint('l2')],
        meta: {multiEndpoint: true, configureKey: 2},
        endpoint: (device) => {
            return {'l1': 1, 'l2': 2};
        },
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint1 = device.getEndpoint(1);
            await reporting.bind(endpoint1, coordinatorEndpoint, ['genOnOff']);
            const endpoint2 = device.getEndpoint(2);
            await reporting.bind(endpoint2, coordinatorEndpoint, ['genOnOff']);
        },
    },

    // Climax
    {
        zigbeeModel: ['PSS_00.00.00.15TC'],
        model: 'PSS-23ZBS',
        vendor: 'Climax',
        description: 'Power plug',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['SD8SC_00.00.03.12TC'],
        model: 'SD-8SCZBS',
        vendor: 'Climax',
        description: 'Smoke detector',
        fromZigbee: [fz.ias_smoke_alarm_1, fz.battery],
        toZigbee: [tz.warning],
        exposes: [e.smoke(), e.battery(), e.battery_low(), e.tamper(), e.warning()],

    },
    {
        zigbeeModel: ['WS15_00.00.00.10TC'],
        model: 'WLS-15ZBS',
        vendor: 'Climax',
        description: 'Water leakage sensor',
        fromZigbee: [fz.ias_water_leak_alarm_1, fz.battery],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['SCM-3_00.00.03.15'],
        model: 'SCM-5ZBS',
        vendor: 'Climax',
        description: 'Roller shutter',
        fromZigbee: [fz.cover_position_via_brightness, fz.cover_state_via_onoff],
        toZigbee: [tz.cover_via_brightness],
        exposes: [e.cover_position().setAccess('state', ea.ALL)],
    },
    {
        zigbeeModel: ['PSM_00.00.00.35TC', 'PSMP5_00.00.02.02TC', 'PSMP5_00.00.05.01TC', 'PSMP5_00.00.05.10TC', 'PSMP5_00.00.03.15TC',
            'PSMP5_00.00.03.16TC', 'PSMP5_00.00.03.19TC'],
        model: 'PSM-29ZBSR',
        vendor: 'Climax',
        description: 'Power plug',
        fromZigbee: [fz.on_off, fz.metering, fz.ignore_basic_report],
        toZigbee: [tz.on_off, tz.ignore_transition],
        meta: {configureKey: 4},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.instantaneousDemand(endpoint, {min: 10, change: 2});
        },
        whiteLabel: [{vendor: 'Blaupunkt', model: 'PSM-S1'}],
        exposes: [e.switch(), e.power(), e.energy()],
    },
    {
        zigbeeModel: ['RS_00.00.02.06TC'],
        model: 'RS-23ZBS',
        vendor: 'Climax',
        description: 'Temperature & humidity sensor',
        fromZigbee: [fz.temperature, fz.humidity],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'msRelativeHumidity']);
            await reporting.temperature(endpoint);
            // configureReporting.humidity(endpoint); not needed and fails
            // https://github.com/Koenkk/zigbee-herdsman-converters/issues/1312
        },
        exposes: [e.temperature(), e.humidity()],
    },
    {
        zigbeeModel: ['SRACBP5_00.00.03.06TC', 'SRAC_00.00.00.16TC'],
        model: 'SRAC-23B-ZBSR',
        vendor: 'Climax',
        description: 'Smart siren',
        fromZigbee: [fz.battery],
        toZigbee: [tz.warning],
        exposes: [e.warning(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['WS15_00.00.00.14TC'],
        model: 'WS-15ZBS',
        vendor: 'Climax',
        description: 'Water leak sensor',
        fromZigbee: [fz.ias_water_leak_alarm_1],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['CO_00.00.00.15TC', 'CO_00.00.00.22TC'],
        model: 'CO-8ZBS',
        vendor: 'Climax',
        description: 'Smart carbon monoxide sensor',
        fromZigbee: [fz.ias_carbon_monoxide_alarm_1, fz.battery],
        toZigbee: [],
        exposes: [e.carbon_monoxide(), e.battery_low(), e.tamper(), e.battery()],
    },

    // Niviss
    {
        zigbeeModel: ['NIV-ZC-OFD'],
        model: 'PS-ZIGBEE-SMART-CONTROLER-1CH-DIMMABLE',
        vendor: 'Niviss',
        description: 'Zigbee smart controller',
        extend: preset.light_onoff_brightness(),
    },

    // HEIMAN
    ...require('./devices/heiman'),

    // Oujiabao
    {
        zigbeeModel: ['OJB-CR701-YZ'],
        model: 'CR701-YZ',
        vendor: 'Oujiabao',
        description: 'Gas and carbon monoxide alarm',
        fromZigbee: [fz.ias_carbon_monoxide_alarm_1_gas_alarm_2],
        toZigbee: [],
        exposes: [e.gas(), e.carbon_monoxide(), e.tamper(), e.battery_low()],
    },

    // Calex
    {
        zigbeeModel: ['EC-Z3.0-CCT'],
        model: '421786',
        vendor: 'Calex',
        description: 'LED A60 Zigbee GLS-lamp',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['EC-Z3.0-RGBW'],
        model: '421792',
        vendor: 'Calex',
        description: 'LED A60 Zigbee RGB lamp',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['Smart Wall Switch '], // Yes, it has a space at the end :(
        model: '421782',
        vendor: 'Calex',
        description: 'Smart Wall Switch, wall mounted RGB controller',
        toZigbee: [],
        fromZigbee: [fz.command_off, fz.command_on, fz.command_step, fz.command_move_to_color_temp,
            fz.command_move, fz.command_stop, fz.command_ehanced_move_to_hue_and_saturation,
        ],
        exposes: [e.action([
            'on', 'off', 'color_temperature_move', 'brightness_step_up', 'brightness_step_down',
            'brightness_move_up', 'brightness_move_down', 'brightness_stop',
            'enhanced_move_to_hue_and_saturation',
        ])],
        meta: {configureKey: 1, disableActionGroup: true},
    },

    // EcoSmart
    {
        zigbeeModel: ['Ecosmart-ZBT-A19-CCT-Bulb'],
        model: 'A9A19A60WESDZ02',
        vendor: 'EcoSmart',
        description: 'Tuneable white (A19)',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['Ecosmart-ZBT-BR30-CCT-Bulb'],
        model: 'A9BR3065WESDZ02',
        vendor: 'EcoSmart',
        description: 'Tuneable white (BR30)',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['zhaRGBW'],
        model: 'D1821',
        vendor: 'EcoSmart',
        description: 'A19 RGB bulb',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        // eslint-disable-next-line
        zigbeeModel: ['\u0000\u0002\u0000\u0004\u0000\f^I\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e','\u0000\u0002\u0000\u0004^��&\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e'],
        model: 'D1531',
        vendor: 'EcoSmart',
        description: 'A19 bright white bulb',
        extend: preset.light_onoff_brightness(),
    },
    {
        // eslint-disable-next-line
        zigbeeModel: ['\u0000\u0002\u0000\u0004\u0012 �P\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e'],
        model: 'D1532',
        vendor: 'EcoSmart',
        description: 'A19 soft white bulb',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['zhaTunW'],
        model: 'D1542',
        vendor: 'EcoSmart',
        description: 'GU10 adjustable white bulb',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        // eslint-disable-next-line
        zigbeeModel: ['\u0000\u0002\u0000\u0004\u0000\f]�\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e', '\u0000\u0002\u0000\u0004\"�T\u0004\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e', '\u0000\u0002\u0000\u0004\u0000\f^�\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e','\u0000\u0002\u0000\u0004\u0011�\"�\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e','\u0000\u0002\u0000\u0004� �P\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e','\u0000\u0002\u0000\u0004\u0000\f^\u0014\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e'],
        model: 'D1533',
        vendor: 'EcoSmart',
        description: 'PAR20/A19 bright white bulb',
        extend: preset.light_onoff_brightness(),
    },
    {
        // eslint-disable-next-line
        zigbeeModel: ['\u0000\u0002\u0000\u0004�V\u0000\n\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e', '\u0000\u0002\u0000\u0004��\"�\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u000e'],
        model: 'D1523',
        vendor: 'EcoSmart',
        description: 'A19 soft white bulb',
        extend: preset.light_onoff_brightness(),
    },

    // Lubeez
    {
        zigbeeModel: ['LUBEEZ-12AB'],
        model: '12AB',
        vendor: 'Lubeez',
        description: 'zigbee 3.0 AC dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },

    // Airam
    {
        zigbeeModel: ['ZBT-DimmableLight'],
        model: '4713407',
        vendor: 'Airam',
        description: 'LED OP A60 ZB 9W/827 E27',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
            const payload = [{attribute: 'currentLevel', minimumReportInterval: 300, maximumReportInterval: repInterval.HOUR,
                reportableChange: 1}];
            await endpoint.configureReporting('genLevelCtrl', payload);
        },
    },
    {
        zigbeeModel: ['ZBT-Remote-EU-DIMV1A2'],
        model: 'AIRAM-CTR.U',
        vendor: 'Airam',
        description: 'CTR.U remote',
        exposes: [e.action(['on', 'off', 'brightness_down_click', 'brightness_up_click', 'brightness_down_hold', 'brightness_up_hold',
            'brightness_down_release', 'brightness_up_release'])],
        fromZigbee: [fz.command_on, fz.legacy.genOnOff_cmdOn, fz.command_off, fz.legacy.genOnOff_cmdOff,
            fz.legacy.CTR_U_brightness_updown_click, fz.ignore_basic_report,
            fz.legacy.CTR_U_brightness_updown_hold, fz.legacy.CTR_U_brightness_updown_release, fz.command_recall, fz.legacy.CTR_U_scene],
        toZigbee: [],
    },
    {
        zigbeeModel: ['ZBT-Remote-EU-DIMV2A2'],
        model: 'CTR.UBX',
        vendor: 'Airam',
        description: 'CTR.U remote BX',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_step, fz.command_move, fz.command_stop, fz.command_recall,
            fz.ignore_basic_report],
        exposes: [e.action(['on', 'off', 'brightness_step_up', 'brightness_step_down', 'brightness_move_up', 'brightness_move_down',
            'brightness_stop', 'recall_*'])],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genBasic', 'genOnOff', 'genLevelCtrl', 'genScenes']);
        },
    },
    {
        zigbeeModel: ['Dimmable-GU10-4713404'],
        model: '4713406',
        vendor: 'Airam',
        description: 'GU10 spot 4.8W 2700K 385lm',
        extend: preset.light_onoff_brightness(),
    },

    // Paul Neuhaus
    {
        zigbeeModel: ['NLG-remote', 'Neuhaus remote'],
        model: '100.462.31',
        vendor: 'Paul Neuhaus',
        description: 'Q-REMOTE',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_toggle, fz.command_step, fz.command_move_to_color_temp, fz.command_stop,
            fz.command_move_to_color, fz.command_move, fz.command_color_loop_set, fz.command_ehanced_move_to_hue_and_saturation,
            fz.tint_scene, fz.command_recall],
        exposes: [e.action(['on', 'off', 'toggle', 'brightness_step_up', 'brightness_step_down', 'color_temperature_move', 'color_move',
            'brightness_stop', 'brightness_move_up', 'brightness_move_down', 'color_loop_set', 'enhanced_move_to_hue_and_saturation',
            'recall_*', 'scene_*'])],
        toZigbee: [],
    },
    {
        zigbeeModel: ['NLG-CCT light'],
        model: 'NLG-CCT light',
        vendor: 'Paul Neuhaus',
        description: 'Various color temperature lights (e.g. 100.424.11)',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['Neuhaus NLG-TW light', 'NLG-TW light'],
        model: 'NLG-TW light',
        vendor: 'Paul Neuhaus',
        description: 'Various tunable white lights (e.g. 8195-55)',
        extend: preset.light_onoff_brightness_colortemp({colorTempRange: [153, 370]}),
    },
    {
        zigbeeModel: ['NLG-RGBW light '], // the space as the end is intentional, as this is what the device sends
        model: 'NLG-RGBW_light',
        vendor: 'Paul Neuhaus',
        description: 'Various RGBW lights (e.g. 100.110.39)',
        extend: preset.light_onoff_brightness_colortemp_color(),
        endpoint: (device) => {
            return {'default': 2};
        },
    },
    {
        zigbeeModel: ['NLG-RGBW light'],
        model: 'NLG-RGBW light',
        vendor: 'Paul Neuhaus',
        description: 'Various RGBW lights (e.g. 100.111.57)',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['NLG-RGB-TW light'],
        model: 'NLG-RGB-TW light',
        vendor: 'Paul Neuhaus',
        description: 'Various RGB + tunable white lights (e.g. 100.470.92)',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['NLG-plug'],
        model: '100.425.90',
        vendor: 'Paul Neuhaus',
        description: 'Q-PLUG adapter plug with night orientation light',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['JZ-CT-Z01'],
        model: '100.110.51',
        vendor: 'Paul Neuhaus',
        description: 'Q-FLAG LED panel, Smart-Home CCT',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['JZ-RGBW-Z01'],
        model: '100.075.74',
        vendor: 'Paul Neuhaus',
        description: 'Q-VIDAL RGBW ceiling lamp, 6032-55',
        endpoint: (device) => {
            return {'default': 2};
        },
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['JZD60-J4R150'],
        model: '100.001.96',
        vendor: 'Paul Neuhaus',
        description: 'Q-LED Lamp RGBW E27 socket',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['Neuhaus RGB+CCT light'],
        model: '100.491.61',
        vendor: 'Paul Neuhaus',
        description: 'Q-MIA LED RGBW wall lamp, 9185-13',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },

    // iCasa
    ...require('./devices/icasa'),

    // Busch-Jaeger
    {
        zigbeeModel: ['PU01'],
        model: '6717-84',
        vendor: 'Busch-Jaeger',
        description: 'Adaptor plug',
        extend: preset.switch(),
    },
    {
        // Busch-Jaeger 6735, 6736, and 6737 have been tested with the 6710 U (Power Adapter) and
        // 6711 U (Relay) back-ends. The dimmer has not been verified to work yet, though it's
        // safe to assume that it can at least been turned on or off with this integration.
        //
        // In order to manually capture scenes as described in the devices manual, the endpoint
        // corresponding to the row needs to be unbound (https://www.zigbee2mqtt.io/information/binding.html)
        // If that operation was successful, the switch will respond to button presses on that
        // by blinking multiple times (vs. just blinking once if it's bound).
        zigbeeModel: ['RM01', 'RB01'],
        model: '6735/6736/6737',
        vendor: 'Busch-Jaeger',
        description: 'Zigbee Light Link power supply/relay/dimmer',
        endpoint: (device) => {
            return {'row_1': 0x0a, 'row_2': 0x0b, 'row_3': 0x0c, 'row_4': 0x0d, 'relay': 0x12};
        },
        exposes: [e.switch(), e.action(['row_1_on', 'row_1_off', 'row_1_up', 'row_1_down', 'row_1_stop',
            'row_2_on', 'row_2_off', 'row_2_up', 'row_2_down', 'row_2_stop',
            'row_3_on', 'row_3_off', 'row_3_up', 'row_3_down', 'row_3_stop',
            'row_4_on', 'row_4_off', 'row_4_up', 'row_4_down', 'row_4_stop'])],
        meta: {configureKey: 3, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            let firstEndpoint = 0x0a;

            const switchEndpoint10 = device.getEndpoint(10);
            if (switchEndpoint10 != null && switchEndpoint10.supportsOutputCluster('genOnOff')) {
                // https://github.com/Koenkk/zigbee2mqtt/issues/3027#issuecomment-606169628
                await reporting.bind(switchEndpoint10, coordinatorEndpoint, ['genOnOff']);
            }

            const switchEndpoint12 = device.getEndpoint(0x12);
            if (switchEndpoint12 != null) {
                firstEndpoint++;
                await reporting.bind(switchEndpoint12, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            }

            // Depending on the actual devices - 6735, 6736, or 6737 - there are 1, 2, or 4 endpoints.
            for (let i = firstEndpoint; i <= 0x0d; i++) {
                const endpoint = device.getEndpoint(i);
                if (endpoint != null) {
                    // The total number of bindings seems to be severely limited with these devices.
                    // In order to be able to toggle groups, we need to remove the scenes cluster
                    const index = endpoint.outputClusters.indexOf(5);
                    if (index > -1) {
                        endpoint.outputClusters.splice(index, 1);
                    }
                    await reporting.bind(endpoint, coordinatorEndpoint, ['genLevelCtrl']);
                }
            }
        },
        fromZigbee: [fz.ignore_basic_report, fz.on_off, fz.brightness, fz.legacy.RM01_on_click, fz.legacy.RM01_off_click,
            fz.legacy.RM01_up_hold, fz.legacy.RM01_down_hold, fz.legacy.RM01_stop],
        toZigbee: [tz.RM01_light_onoff_brightness, tz.RM01_light_brightness_step, tz.RM01_light_brightness_move],
        onEvent: async (type, data, device) => {
            const switchEndpoint = device.getEndpoint(0x12);
            if (switchEndpoint == null) {
                return;
            }

            // This device doesn't support reporting.
            // Therefore we read the on/off state every 5 seconds.
            // This is the same way as the Hue bridge does it.
            if (type === 'stop') {
                clearInterval(globalStore.getValue(device, 'interval'));
                globalStore.clearValue(device, 'interval');
            } else if (!globalStore.hasValue(device, 'interval')) {
                const interval = setInterval(async () => {
                    try {
                        await switchEndpoint.read('genOnOff', ['onOff']);
                        await switchEndpoint.read('genLevelCtrl', ['currentLevel']);
                    } catch (error) {
                        // Do nothing
                    }
                }, 5000);
                globalStore.putValue(device, 'interval', interval);
            }
        },
    },

    // Müller Licht
    ...require('./devices/müller_licht'),

    // Salus Controls
    {
        zigbeeModel: ['SPE600'],
        model: 'SPE600',
        vendor: 'Salus Controls',
        description: 'Smart plug (EU socket)',
        fromZigbee: [fz.on_off, fz.metering],
        toZigbee: [tz.on_off],
        meta: {configureKey: 4},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(9);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.instantaneousDemand(endpoint, {min: 5, change: 10});
            await reporting.currentSummDelivered(endpoint, {min: 5, change: [0, 10]});
            await endpoint.read('seMetering', ['multiplier', 'divisor']);
        },
        ota: ota.salus,
        exposes: [e.switch(), e.power(), e.energy()],
    },
    {
        zigbeeModel: ['SP600'],
        model: 'SP600',
        vendor: 'Salus Controls',
        description: 'Smart plug (UK socket)',
        fromZigbee: [fz.on_off, fz.SP600_power],
        exposes: [e.switch(), e.power(), e.energy()],
        toZigbee: [tz.on_off],
        meta: {configureKey: 4},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(9);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.instantaneousDemand(endpoint, {min: 5, change: 10});
            await reporting.currentSummDelivered(endpoint, {min: 5, change: [0, 10]});
            await endpoint.read('seMetering', ['multiplier', 'divisor']);
        },
        ota: ota.salus,
    },
    {
        zigbeeModel: ['SR600'],
        model: 'SR600',
        vendor: 'Salus Controls',
        description: 'Relay switch',
        extend: preset.switch(),
        meta: {configureKey: 4},
        ota: ota.salus,
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(9);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['SW600'],
        model: 'SW600',
        vendor: 'Salus Controls',
        description: 'Door or window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper()],
        ota: ota.salus,
    },
    {
        zigbeeModel: ['WLS600'],
        model: 'WLS600',
        vendor: 'Salus Controls',
        description: 'Water leakage sensor',
        fromZigbee: [fz.ias_water_leak_alarm_1],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper()],
        ota: ota.salus,
    },
    {
        zigbeeModel: ['OS600'],
        model: 'OS600',
        vendor: 'Salus Controls',
        description: 'Door or window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper()],
        ota: ota.salus,
    },
    {
        zigbeeModel: ['RE600'],
        model: 'RE600',
        vendor: 'Salus Controls',
        description: 'Router Zigbee',
        fromZigbee: [],
        toZigbee: [],
        exposes: [],
        ota: ota.salus,
    },

    // AduroSmart
    {
        zigbeeModel: ['ZLL-ExtendedColo', 'ZLL-ExtendedColor', 'AD-RGBW3001'],
        model: '81809/81813',
        vendor: 'AduroSmart',
        description: 'ERIA colors and white shades smart light bulb A19/BR30',
        extend: preset.light_onoff_brightness_colortemp_color(),
        meta: {applyRedFix: true},
        endpoint: (device) => {
            return {'default': 2};
        },
    },
    {
        zigbeeModel: ['Adurolight_NCC'],
        model: '81825',
        vendor: 'AduroSmart',
        description: 'ERIA smart wireless dimming switch',
        fromZigbee: [fz.command_on, fz.command_off, fz.legacy.eria_81825_updown],
        exposes: [e.action(['on', 'off', 'up', 'down'])],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
        },
    },
    {
        zigbeeModel: ['AD-Dimmer'],
        model: '81849',
        vendor: 'AduroSmart',
        description: 'ERIA build-in multi dimmer module 300W',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
            await reporting.brightness(endpoint);
        },
    },
    {
        zigbeeModel: ['BDP3001'],
        model: '81855',
        vendor: 'AduroSmart',
        description: 'ERIA smart plug (dimmer)',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
            await reporting.brightness(endpoint);
        },
    },
    {
        zigbeeModel: ['BPU3'],
        model: 'BPU3',
        vendor: 'AduroSmart',
        description: 'ERIA smart plug',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // Danfoss
    {
        zigbeeModel: ['eTRV0100'],
        model: '014G2461',
        vendor: 'Danfoss',
        description: 'Ally thermostat',
        fromZigbee: [fz.battery, fz.legacy.thermostat_att_report, fz.danfoss_thermostat],
        toZigbee: [tz.thermostat_occupied_heating_setpoint, tz.thermostat_local_temperature, tz.danfoss_mounted_mode,
            tz.danfoss_thermostat_orientation, tz.danfoss_algorithm_scale_factor, tz.danfoss_heat_available, tz.danfoss_day_of_week,
            tz.danfoss_trigger_time, tz.danfoss_window_open, tz.danfoss_display_orientation, tz.thermostat_keypad_lockout],
        exposes: [e.battery(), e.keypad_lockout(),
            exposes.binary('mounted_mode', ea.STATE, true, false).withDescription(
                'Mode in which the unit is mounted. This is set to `false` for normal mounting or `true` for vertical mounting'),
            exposes.binary('heat_required', ea.STATE, true, false).withDescription('Wether or not the unit needs warm water'),
            exposes.binary('window_open_internal', ea.STATE, 1, 0)
                .withDescription('0=Quarantine, 1=Windows are closed, 2=Hold - Windows are maybe about to open, ' +
                '3=Open window detected, 4=In window open state from external but detected closed locally'),
            exposes.binary('setpoint_change_source', ea.STATE, 0, 1)
                .withDescription('Values observed are `0` (set locally) or `2` (set via Zigbee)'),
            exposes.climate().withSetpoint('occupied_heating_setpoint', 6, 28, 0.5).withLocalTemperature().withPiHeatingDemand(),
            exposes.binary('window_open_external', ea.ALL, true, false),
            exposes.numeric('day_of_week', ea.ALL).withValueMin(0).withValueMax(7)
                .withDescription('Exercise day of week: 0=Sun...6=Sat, 7=undefined'),
            exposes.numeric('trigger_time', ea.ALL).withValueMin(0).withValueMax(65535)
                .withDescription('Exercise trigger time. Minutes since midnight (65535=undefined)'),
            exposes.binary('heat_available', ea.ALL, true, false),
            exposes.numeric('algorithm_scale_factor', ea.ALL).withValueMin(1).withValueMax(10)
                .withDescription('Scale factor of setpoint filter timeconstant'+
                ' ("aggressiveness" of control algorithm) 1= Quick ...  5=Moderate ... 10=Slow')],
        meta: {configureKey: 4},
        ota: ota.zigbeeOTA,
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const options = {manufacturerCode: 0x1246};
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'hvacThermostat']);

            // standard ZCL attributes
            await reporting.batteryPercentageRemaining(endpoint, {min: 60, max: 43200, change: 1});
            await reporting.thermostatTemperature(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 25});
            await reporting.thermostatPIHeatingDemand(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 1});
            await reporting.thermostatOccupiedHeatingSetpoint(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 25});

            // danfoss attributes
            await endpoint.configureReporting('hvacThermostat', [{attribute: {ID: 0x4012, type: 0x10}, minimumReportInterval: 0,
                maximumReportInterval: repInterval.MINUTES_10, reportableChange: 1}], options);
            await endpoint.configureReporting('hvacThermostat', [{attribute: {ID: 0x4000, type: 0x30}, minimumReportInterval: 0,
                maximumReportInterval: repInterval.HOUR, reportableChange: 1}], options);

            // read keypadLockout, we don't need reporting as it cannot be set physically on the device
            await endpoint.read('hvacUserInterfaceCfg', ['keypadLockout']);
            await endpoint.read('hvacThermostat', [0x4003, 0x4010, 0x4011, 0x4020], options);

            // Seems that it is bug in Danfoss, device does not asks for the time with binding
            // So, we need to write time during configure (same as for HEIMAN devices)
            const time = Math.round(((new Date()).getTime() - OneJanuary2000) / 1000);
            // Time-master + synchronised
            const values = {timeStatus: 3, time: time, timeZone: ((new Date()).getTimezoneOffset() * -1) * 60};
            endpoint.write('genTime', values);
        },
    },

    // Eurotronic
    {
        zigbeeModel: ['SPZB0001'],
        model: 'SPZB0001',
        vendor: 'Eurotronic',
        description: 'Spirit Zigbee wireless heater thermostat',
        fromZigbee: [fz.legacy.eurotronic_thermostat, fz.battery],
        toZigbee: [tz.thermostat_occupied_heating_setpoint, tz.thermostat_unoccupied_heating_setpoint,
            tz.thermostat_local_temperature_calibration, tz.eurotronic_thermostat_system_mode, tz.eurotronic_host_flags,
            tz.eurotronic_error_status, tz.thermostat_setpoint_raise_lower, tz.thermostat_control_sequence_of_operation,
            tz.thermostat_remote_sensing, tz.thermostat_local_temperature, tz.thermostat_running_state,
            tz.eurotronic_current_heating_setpoint, tz.eurotronic_trv_mode, tz.eurotronic_valve_position],
        exposes: [e.battery(), exposes.climate().withSetpoint('occupied_heating_setpoint', 5, 30, 0.5).withLocalTemperature()
            .withSystemMode(['off', 'auto', 'heat']).withRunningState(['idle', 'heat']).withLocalTemperatureCalibration()
            .withPiHeatingDemand(),
        exposes.enum('eurotronic_trv_mode', exposes.access.ALL, [1, 2])
            .withDescription('Select between direct control of the valve via the `eurotronic_valve_position` or automatic control of the '+
            'valve based on the `current_heating_setpoint`. For manual control set the value to 1, for automatic control set the value '+
            'to 2 (the default). When switched to manual mode the display shows a value from 0 (valve closed) to 100 (valve fully open) '+
            'and the buttons on the device are disabled.'),
        exposes.numeric('eurotronic_valve_position', exposes.access.ALL).withValueMin(0).withValueMax(255)
            .withDescription('Directly control the radiator valve when `eurotronic_trv_mode` is set to 1. The values range from 0 (valve '+
            'closed) to 255 (valve fully open)')],
        meta: {configureKey: 3},
        ota: ota.zigbeeOTA,
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const options = {manufacturerCode: 4151};
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'hvacThermostat']);
            await reporting.thermostatTemperature(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 25});
            await reporting.thermostatPIHeatingDemand(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 1});
            await reporting.thermostatOccupiedHeatingSetpoint(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 25});
            await reporting.thermostatUnoccupiedHeatingSetpoint(endpoint, {min: 0, max: repInterval.MINUTES_10, change: 25});
            await endpoint.configureReporting('hvacThermostat', [{attribute: {ID: 0x4003, type: 41}, minimumReportInterval: 0,
                maximumReportInterval: repInterval.MINUTES_10, reportableChange: 25}], options);
            await endpoint.configureReporting('hvacThermostat', [{attribute: {ID: 0x4008, type: 34}, minimumReportInterval: 0,
                maximumReportInterval: repInterval.HOUR, reportableChange: 1}], options);
        },
    },

    // Livolo
    ...require('./devices/livolo'),

    // Bosch
    {
        zigbeeModel: ['RFDL-ZB', 'RFDL-ZB-EU', 'RFDL-ZB-H', 'RFDL-ZB-K', 'RFDL-ZB-CHI', 'RFDL-ZB-MS', 'RFDL-ZB-ES', 'RFPR-ZB',
            'RFPR-ZB-EU', 'RFPR-ZB-CHI', 'RFPR-ZB-ES', 'RFPR-ZB-MS'],
        model: 'RADON TriTech ZB',
        vendor: 'Bosch',
        description: 'Wireless motion detector',
        fromZigbee: [fz.temperature, fz.battery, fz.ias_occupancy_alarm_1],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2500'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.temperature(), e.battery(), e.occupancy(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['ISW-ZPR1-WP13'],
        model: 'ISW-ZPR1-WP13',
        vendor: 'Bosch',
        description: 'Motion sensor',
        fromZigbee: [fz.temperature, fz.battery, fz.ias_occupancy_alarm_1, fz.ignore_iaszone_report],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2500'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(5);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.temperature(), e.battery(), e.occupancy(), e.battery_low(), e.tamper()],
    },

    // Immax
    ...require('./devices/immax'),

    // Yale
    ...require('./devices/yale'),

    // JAVIS
    {
        zigbeeModel: ['JAVISLOCK'],
        fingerprint: [{modelID: 'doorlock_5001', manufacturerName: 'Lmiot'}],
        model: 'JS-SLK2-ZB',
        vendor: 'JAVIS',
        description: 'Intelligent biometric digital lock',
        fromZigbee: [fz.javis_lock_report, fz.battery],
        toZigbee: [],
        exposes: [e.battery(), e.action(['unlock'])],
    },

    // Weiser
    {
        zigbeeModel: ['SMARTCODE_DEADBOLT_10'],
        model: '9GED18000-009',
        vendor: 'Weiser',
        description: 'SmartCode 10',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery, fz.lock_programming_event, fz.lock_pin_code_response],
        toZigbee: [tz.lock, tz.pincode_lock],
        meta: {configureKey: 4, pinCodeCount: 30},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(2);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        // Note - Keypad triggered deletions do not cause a zigbee event, though Adds work fine.
        onEvent: async (type, data, device) => {
            // When we receive a code updated message, lets read the new value
            if (data.type === 'commandProgrammingEventNotification' &&
                data.cluster === 'closuresDoorLock' &&
                data.data &&
                data.data.userid !== undefined &&
                // Don't read RF events, we can do this with retrieve_state
                (data.data.programeventsrc === undefined || constants.lockSourceName[data.data.programeventsrc] != 'rf')
            ) {
                await device.endpoints[0].command('closuresDoorLock', 'getPinCode', {userid: data.data.userid}, {});
            }
        },
        exposes: [e.lock(), e.battery()],
    },
    {
        zigbeeModel: ['SMARTCODE_DEADBOLT_10T'],
        model: '9GED21500-005',
        vendor: 'Weiser',
        description: 'SmartCode 10 Touch',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery],
        toZigbee: [tz.lock],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(2);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },

    // Keen Home
    {
        zigbeeModel: ['SV01-410-MP-1.0', 'SV01-410-MP-1.1', 'SV01-410-MP-1.4', 'SV01-410-MP-1.5', 'SV01-412-MP-1.0',
            'SV01-412-MP-1.4', 'SV01-610-MP-1.0', 'SV01-612-MP-1.0'],
        model: 'SV01',
        vendor: 'Keen Home',
        description: 'Smart vent',
        fromZigbee: [fz.cover_position_via_brightness, fz.temperature, fz.battery, fz.keen_home_smart_vent_pressure,
            fz.ignore_onoff_report],
        toZigbee: [tz.cover_via_brightness],
        meta: {configureKey: 1, battery: {dontDividePercentage: true}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const binds = ['genLevelCtrl', 'genPowerCfg', 'msTemperatureMeasurement', 'msPressureMeasurement'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.temperature(endpoint);
            await reporting.pressure(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.cover_position().setAccess('state', ea.ALL), e.temperature(), e.battery(), e.pressure()],
    },
    {
        zigbeeModel: ['SV02-410-MP-1.3', 'SV02-610-MP-1.3', 'SV02-410-MP-1.0'],
        model: 'SV02',
        vendor: 'Keen Home',
        description: 'Smart vent',
        fromZigbee: [fz.cover_position_via_brightness, fz.temperature, fz.battery, fz.keen_home_smart_vent_pressure,
            fz.ignore_onoff_report],
        toZigbee: [tz.cover_via_brightness],
        meta: {configureKey: 1, battery: {dontDividePercentage: true}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const binds = ['genLevelCtrl', 'genPowerCfg', 'msTemperatureMeasurement', 'msPressureMeasurement'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.temperature(endpoint);
            await reporting.pressure(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.cover_position().setAccess('state', ea.ALL), e.temperature(), e.battery(), e.pressure()],
    },

    // AXIS
    {
        zigbeeModel: ['Gear'],
        model: 'GR-ZB01-W',
        vendor: 'AXIS',
        description: 'Gear window shade motor',
        fromZigbee: [fz.cover_position_via_brightness, fz.battery],
        toZigbee: [tz.cover_via_brightness],
        meta: {configureKey: 1, battery: {dontDividePercentage: true}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genLevelCtrl', 'genPowerCfg']);
            await reporting.brightness(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.cover_position().setAccess('state', ea.ALL), e.battery()],
    },

    // ELKO
    {
        zigbeeModel: ['ElkoDimmerZHA'],
        model: '316GLEDRF',
        vendor: 'ELKO',
        description: 'ZigBee in-wall smart dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {disableDefaultResponse: true, configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // LivingWise
    {
        zigbeeModel: ['abb71ca5fe1846f185cfbda554046cce'],
        model: 'LVS-ZB500D',
        vendor: 'LivingWise',
        description: 'ZigBee smart dimmer switch',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['545df2981b704114945f6df1c780515a'],
        model: 'LVS-ZB15S',
        vendor: 'LivingWise',
        description: 'ZigBee smart in-wall switch',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['e70f96b3773a4c9283c6862dbafb6a99'],
        model: 'LVS-SM10ZW',
        vendor: 'LivingWise',
        description: 'Door or window contact switch',
        fromZigbee: [fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['895a2d80097f4ae2b2d40500d5e03dcc', '700ae5aab3414ec09c1872efe7b8755a'],
        model: 'LVS-SN10ZW_SN11',
        vendor: 'LivingWise',
        description: 'Occupancy sensor',
        fromZigbee: [fz.battery, fz.ias_occupancy_alarm_1_with_timeout],
        toZigbee: [],
        exposes: [e.battery(), e.occupancy(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['55e0fa5cdb144ba3a91aefb87c068cff'],
        model: 'LVS-ZB15R',
        vendor: 'LivingWise',
        description: 'Zigbee smart outlet',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['75d430d66c164c26ac8601c05932dc94'],
        model: 'LVS-SC7',
        vendor: 'LivingWise',
        description: 'Scene controller ',
        fromZigbee: [fz.orvibo_raw_2],
        exposes: [e.action([
            'button_1_click', 'button_1_hold', 'button_1_release', 'button_2_click', 'button_2_hold', 'button_2_release',
            'button_3_click', 'button_3_hold', 'button_3_release', 'button_4_click', 'button_4_hold', 'button_4_release',
            'button_5_click', 'button_5_hold', 'button_5_release', 'button_6_click', 'button_6_hold', 'button_6_release',
            'button_7_click', 'button_7_hold', 'button_7_release'])],
        toZigbee: [],
    },

    // FrankEver
    {
        fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_wt9agwf3'}],
        model: 'FK_V02',
        vendor: 'FrankEver',
        description: 'Zigbee smart water valve',
        fromZigbee: [fz.frankever_valve],
        toZigbee: [tz.tuya_switch_state, tz.frankever_threshold, tz.frankever_timer],
        exposes: [e.switch().setAccess('state', ea.STATE_SET),
            exposes.numeric('threshold', exposes.access.STATE_SET).withValueMin(0).withValueMax(100).withUnit('%')
                .withDescription('Valve open percentage (multiple of 10)'),
            exposes.numeric('timer', exposes.access.STATE_SET).withValueMin(0).withValueMax(600).withUnit('minutes')
                .withDescription('Countdown timer in minutes')],
    },

    // Vimar
    {
        zigbeeModel: ['2_Way_Switch_v1.0', 'On_Off_Switch_v1.0'],
        model: '14592.0',
        vendor: 'Vimar',
        description: '2-way switch IoT connected mechanism',
        extend: preset.switch(),
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(10);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
        },
    },
    {
        zigbeeModel: ['Window_Cov_v1.0'],
        model: '14594',
        vendor: 'Vimar',
        description: 'Roller shutter with slat orientation and change-over relay',
        fromZigbee: [fz.cover_position_tilt],
        toZigbee: [tz.cover_state, tz.cover_position_tilt],
        exposes: [e.cover_position()],
    },

    // Stelpro
    ...require('./devices/stelpro'),

    // Nyce
    {
        zigbeeModel: ['3011'],
        model: 'NCZ-3011-HA',
        vendor: 'Nyce',
        description: 'Door/window sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['3043'],
        model: 'NCZ-3043-HA',
        vendor: 'Nyce',
        description: 'Ceiling motion sensor',
        fromZigbee: [fz.occupancy, fz.humidity, fz.temperature, fz.ignore_basic_report, fz.ignore_genIdentify, fz.ignore_poll_ctrl,
            fz.battery, fz.ignore_iaszone_report, fz.ias_occupancy_alarm_2],
        toZigbee: [],
        meta: {battery: {dontDividePercentage: true}},
        exposes: [e.occupancy(), e.humidity(), e.temperature(), e.battery(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['3041'],
        model: 'NCZ-3041-HA',
        vendor: 'Nyce',
        description: 'Wall motion sensor',
        fromZigbee: [fz.occupancy, fz.humidity, fz.temperature, fz.ignore_basic_report, fz.ignore_genIdentify, fz.ignore_poll_ctrl,
            fz.battery, fz.ignore_iaszone_report, fz.ias_occupancy_alarm_2],
        toZigbee: [],
        meta: {battery: {dontDividePercentage: true}},
        exposes: [e.occupancy(), e.humidity(), e.temperature(), e.battery(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['3045'],
        model: 'NCZ-3045-HA',
        vendor: 'Nyce',
        description: 'Curtain motion sensor',
        fromZigbee: [fz.occupancy, fz.humidity, fz.temperature, fz.ignore_basic_report, fz.ignore_genIdentify, fz.ignore_poll_ctrl,
            fz.battery, fz.ignore_iaszone_report, fz.ias_occupancy_alarm_2],
        toZigbee: [],
        meta: {battery: {dontDividePercentage: true}},
        exposes: [e.occupancy(), e.humidity(), e.temperature(), e.battery(), e.battery_low(), e.tamper()],
    },

    // Securifi
    {
        zigbeeModel: ['PP-WHT-US'],
        model: 'PP-WHT-US',
        vendor: 'Securifi',
        description: 'Peanut Smart Plug',
        fromZigbee: [fz.on_off, fz.electrical_measurement],
        toZigbee: [tz.on_off],
        ota: ota.securifi,
        meta: {configureKey: 4},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement']);
            endpoint.saveClusterAttributeKeyValue('haElectricalMeasurement', {
                acVoltageMultiplier: 180, acVoltageDivisor: 39321, acCurrentMultiplier: 72,
                acCurrentDivisor: 39321, acPowerMultiplier: 10255, acPowerDivisor: 39321});
            await reporting.onOff(endpoint);
            await reporting.rmsVoltage(endpoint, {change: 110}); // Voltage reports in 0.00458V
            await reporting.rmsCurrent(endpoint, {change: 55}); // Current reports in 0.00183A
            await reporting.activePower(endpoint, {change: 2}); // Power reports in 0.261W
        },
        exposes: [e.switch(), e.power(), e.current(), e.voltage()],
    },
    {
        zigbeeModel: ['ZB2-BU01'],
        model: 'B01M7Y8BP9',
        vendor: 'Securifi',
        description: 'Almond Click multi-function button',
        fromZigbee: [fz.almond_click],
        exposes: [e.action(['single', 'double', 'long'])],
        toZigbee: [],
    },

    // Visonic
    {
        zigbeeModel: ['MP-841'],
        model: 'MP-841',
        vendor: 'Visonic',
        description: 'Motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['MCT-370 SMA'],
        model: 'MCT-370 SMA',
        vendor: 'Visonic',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['MCT-350 SMA'],
        model: 'MCT-350 SMA',
        vendor: 'Visonic',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['MCT-340 E'],
        model: 'MCT-340 E',
        vendor: 'Visonic',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.temperature, fz.battery, fz.ignore_zclversion_read],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.temperature(), e.battery()],
    },
    {
        zigbeeModel: ['MCT-340 SMA'],
        model: 'MCT-340 SMA',
        vendor: 'Visonic',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.temperature, fz.battery, fz.ignore_zclversion_read],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.temperature(), e.battery()],
    },

    // Sunricher
    ...require('./devices/sunricher'),

    // Samotech
    {
        zigbeeModel: ['SM308'],
        model: 'SM308',
        vendor: 'Samotech',
        description: 'Zigbee AC in wall switch',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genBasic', 'genIdentify', 'genOnOff']);
        },
    },
    {
        zigbeeModel: ['SM309'],
        model: 'SM309',
        vendor: 'Samotech',
        description: 'ZigBee dimmer 400W',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },

    // Shenzhen Homa
    {
        zigbeeModel: ['HOMA1008', '00A'],
        model: 'HLD812-Z-SC',
        vendor: 'Shenzhen Homa',
        description: 'Smart LED driver',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['HOMA1009'],
        model: 'HLD503-Z-CT',
        vendor: 'Shenzhen Homa',
        description: 'Smart LED driver',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['HOMA1002', 'HOMA0019', 'HOMA0006', 'HOMA000F', '019'],
        model: 'HLC610-Z',
        vendor: 'Shenzhen Homa',
        description: 'Wireless dimmable controller',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['HOMA1031'],
        model: 'HLC821-Z-SC',
        vendor: 'Shenzhen Homa',
        description: 'ZigBee AC phase-cut dimmer',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['HOMA1005'],
        model: 'HLC614-ZLL',
        vendor: 'Shenzhen Homa',
        description: '3 channel relay module',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('l1'), e.switch().withEndpoint('l2'), e.switch().withEndpoint('l3')],
        meta: {multiEndpoint: true},
        endpoint: (device) => {
            return {l1: 1, l2: 2, l3: 3};
        },
    },
    {
        zigbeeModel: ['HOMA1064', '012'],
        model: 'HLC833-Z-SC',
        vendor: 'Shenzhen Homa',
        description: 'Wireless dimmable controller',
        extend: preset.light_onoff_brightness(),
    },

    // Honyar
    {
        zigbeeModel: ['00500c35'],
        model: 'U86K31ND6',
        vendor: 'Honyar',
        description: '3 gang switch ',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('left'), e.switch().withEndpoint('right'), e.switch().withEndpoint('center')],
        endpoint: (device) => {
            return {'left': 1, 'center': 2, 'right': 3};
        },
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint1 = device.getEndpoint(1);
            const endpoint2 = device.getEndpoint(2);
            const endpoint3 = device.getEndpoint(3);
            await reporting.bind(endpoint1, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint1);
            await reporting.bind(endpoint2, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint2);
            await reporting.bind(endpoint3, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint3);
        },
    },

    // Danalock
    {
        zigbeeModel: ['V3-BTZB'],
        model: 'V3-BTZB',
        vendor: 'Danalock',
        description: 'BT/ZB smartlock',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery],
        toZigbee: [tz.lock],
        meta: {configureKey: 5},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },

    // NET2GRID
    {
        zigbeeModel: ['SP31           ', 'SP31'],
        model: 'N2G-SP',
        vendor: 'NET2GRID',
        description: 'White Net2Grid power outlet switch with power meter',
        fromZigbee: [fz.command_on, fz.legacy.genOnOff_cmdOn, fz.command_off, fz.legacy.genOnOff_cmdOff, fz.on_off, fz.metering],
        exposes: [e.switch(), e.power(), e.energy()],
        toZigbee: [tz.on_off],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint1 = device.getEndpoint(1);
            await reporting.bind(endpoint1, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint1);

            const endpoint10 = device.getEndpoint(10);
            await reporting.bind(endpoint10, coordinatorEndpoint, ['seMetering']);
            await reporting.readMeteringMultiplierDivisor(endpoint10);
            await reporting.instantaneousDemand(endpoint10);
            await reporting.currentSummDelivered(endpoint10);
            await reporting.currentSummReceived(endpoint10);
        },
    },

    // Third Reality
    {
        zigbeeModel: ['3RSS008Z'],
        model: '3RSS008Z',
        vendor: 'Third Reality',
        description: 'RealitySwitch Plus',
        fromZigbee: [fz.on_off],
        toZigbee: [tz.on_off, tz.ignore_transition],
        exposes: [e.switch()],
    },
    {
        zigbeeModel: ['3RSS007Z'],
        model: '3RSS007Z',
        vendor: 'Third Reality',
        description: 'Smart light switch',
        extend: preset.switch(),
        meta: {disableDefaultResponse: true, configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['3RSL011Z'],
        model: '3RSL011Z',
        vendor: 'Third Reality',
        description: 'Smart light A19',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['3RSL012Z'],
        model: '3RSL012Z',
        vendor: 'Third Reality',
        description: 'Smart light BR30',
        extend: preset.light_onoff_brightness_colortemp(),
    },

    // Hampton Bay
    {
        zigbeeModel: ['HDC52EastwindFan', 'HBUniversalCFRemote'],
        model: '99432',
        vendor: 'Hampton Bay',
        description: 'Universal wink enabled white ceiling fan premier remote control',
        fromZigbee: preset.light_onoff_brightness().fromZigbee.concat([fz.fan]),
        toZigbee: preset.light_onoff_brightness().toZigbee.concat([tz.fan_mode]),
        exposes: [e.light_brightness(), e.fan()],
        meta: {disableDefaultResponse: true, configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl', 'hvacFanCtrl']);
            await reporting.onOff(endpoint);
            await reporting.brightness(endpoint);
            await reporting.fanMode(endpoint);
        },
    },
    {
        zigbeeModel: ['ETI 12-in Puff light'],
        model: '54668161',
        vendor: 'Hampton Bay',
        description: '12 in. LED smart puff',
        extend: preset.light_onoff_brightness_colortemp(),
    },

    // Iluminize
    ...require('./devices/iluminize'),

    // Anchor
    {
        zigbeeModel: ['FB56-SKT17AC1.4'],
        model: '67200BL',
        description: 'Vetaar smart plug',
        vendor: 'Anchor',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(3) || device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // Insta
    {
        zigbeeModel: [' Remote'],
        model: 'InstaRemote',
        vendor: 'Insta',
        description: 'ZigBee Light Link wall/handheld transmitter',
        whiteLabel: [{vendor: 'Gira', model: '2430-100'}, {vendor: 'Gira', model: '2435-10'}, {vendor: 'Jung', model: 'ZLLCD5004M'},
            {vendor: 'Jung', model: 'ZLLLS5004M'}, {vendor: 'Jung', model: 'ZLLA5004M'}, {vendor: 'Jung', model: 'ZLLHS4'}],
        fromZigbee: [fz.legacy.insta_scene_click, fz.command_on, fz.command_off_with_effect, fz.legacy.insta_down_hold,
            fz.legacy.insta_up_hold, fz.legacy.insta_stop],
        exposes: [e.action(['select_*', 'on', 'off', 'down', 'up', 'stop'])],
        toZigbee: [],
        ota: ota.zigbeeOTA,
    },
    {
        zigbeeModel: ['Generic UP Device'],
        model: '57008000',
        vendor: 'Insta',
        description: 'Blinds actor with lift/tilt calibration & with with inputs for wall switches',
        fromZigbee: [fz.cover_position_tilt, fz.command_cover_open, fz.command_cover_close, fz.command_cover_stop],
        toZigbee: [tz.cover_state, tz.cover_position_tilt],
        exposes: [e.cover_position_tilt()],
        endpoint: (device) => {
            return {'default': 6};
        },
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(6), coordinatorEndpoint, ['closuresWindowCovering']);
            await reporting.bind(device.getEndpoint(7), coordinatorEndpoint, ['closuresWindowCovering']);
            await reporting.currentPositionLiftPercentage(device.getEndpoint(6));
            await reporting.currentPositionTiltPercentage(device.getEndpoint(6));

            // Has Unknown power source, force it here.
            device.powerSource = 'Mains (single phase)';
            device.save();
        },
    },

    // RGB Genie
    {
        zigbeeModel: ['RGBgenie ZB-5121'],
        model: 'ZB-5121',
        vendor: 'RGB Genie',
        description: 'Micro remote and dimmer with single scene recall',
        fromZigbee: [fz.battery, fz.command_on, fz.command_off, fz.command_step, fz.command_move, fz.command_stop, fz.command_recall],
        exposes: [e.battery(), e.action(['on', 'off', 'brightness_step_up', 'brightness_step_down', 'brightness_move_up',
            'brightness_move_down', 'brightness_stop', 'recall_*'])],
        toZigbee: [],
        meta: {configureKey: 1, battery: {dontDividePercentage: true}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genPowerCfg']);
            await reporting.batteryVoltage(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
    },
    {
        zigbeeModel: ['RGBgenie ZB-3009'],
        model: 'ZB-3009',
        vendor: 'RGB Genie',
        description: '3 scene remote and dimmer ',
        fromZigbee: [fz.command_recall, fz.command_move_hue, fz.command_move, fz.command_stop, fz.command_on, fz.command_off,
            fz.command_move_to_color_temp, fz.command_move_to_color, fz.command_move_color_temperature],
        toZigbee: [],
        exposes: [e.action(['on', 'off', 'brightness_step_up', 'brightness_step_down', 'brightness_move_up',
            'brightness_move_down', 'brightness_stop', 'recall_*', 'hue_move', 'color_temperature_move', 'color_move',
            'color_temperature_move_up', 'color_temperature_move_down'])],
    },
    {
        zigbeeModel: ['ZGRC-KEY-013'],
        model: 'ZGRC-KEY-013',
        vendor: 'RGB Genie',
        description: '3 Zone remote and dimmer',
        fromZigbee: [fz.battery, fz.command_move, fz.legacy.ZGRC013_brightness_onoff,
            fz.legacy.ZGRC013_brightness, fz.command_stop, fz.legacy.ZGRC013_brightness_stop, fz.command_on,
            fz.legacy.ZGRC013_cmdOn, fz.command_off, fz.legacy.ZGRC013_cmdOff, fz.command_recall],
        exposes: [e.battery(), e.action(['brightness_move_up', 'brightness_move_down', 'brightness_stop', 'on', 'off', 'recall_*'])],
        toZigbee: [],
        meta: {configureKey: 1, multiEndpoint: true, battery: {dontDividePercentage: true}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['RGBgenie ZB-5028'],
        model: 'ZB-5028',
        vendor: 'RGB Genie',
        description: 'RGB remote with 4 endpoints and 3 scene recalls',
        fromZigbee: [fz.battery, fz.command_on, fz.command_off, fz.command_step, fz.command_move, fz.command_stop, fz.command_recall,
            fz.command_move_hue, fz.command_move_to_color, fz.command_move_to_color_temp],
        exposes: [e.battery(), e.action(['on', 'off', 'brightness_step_up', 'brightness_step_down', 'brightness_move_up',
            'brightness_move_down', 'brightness_stop', 'recall_1', 'recall_2', 'recall_3'])],
        toZigbee: [],
        meta: {configureKey: 1, multiEndpoint: true, battery: {dontDividePercentage: true}},
        configure: async (device, coordinatorEndpoint) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genPowerCfg']);
            await reporting.batteryVoltage(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
    },
    {
        zigbeeModel: ['RGBgenie ZB-5004'],
        model: 'ZB-5004',
        vendor: 'RGB Genie',
        description: 'Zigbee 3.0 remote control',
        fromZigbee: [fz.command_recall, fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['recall_*', 'on', 'off', 'brightness_stop', 'brightness_move_up', 'brightness_move_down'])],
        toZigbee: [],
    },

    // Sercomm
    {
        zigbeeModel: ['SZ-ESW01'],
        model: 'SZ-ESW01',
        vendor: 'Sercomm',
        description: 'Telstra smart plug',
        fromZigbee: [fz.on_off, fz.metering],
        exposes: [e.switch(), e.power()],
        toZigbee: [tz.on_off],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.instantaneousDemand(endpoint);
            endpoint.saveClusterAttributeKeyValue('seMetering', {divisor: 1000000, multiplier: 1});
        },
    },
    {
        zigbeeModel: ['SZ-ESW01-AU'],
        model: 'SZ-ESW01-AU',
        vendor: 'Sercomm',
        description: 'Telstra smart plug',
        exposes: [e.switch(), e.power()],
        fromZigbee: [fz.on_off, fz.metering],
        toZigbee: [tz.on_off],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.instantaneousDemand(endpoint);
            endpoint.saveClusterAttributeKeyValue('seMetering', {divisor: 1000000, multiplier: 1});
        },
    },
    {
        zigbeeModel: ['XHS2-SE'],
        model: 'XHS2-SE',
        vendor: 'Sercomm',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.temperature, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.temperature(), e.battery()],
    },
    {
        zigbeeModel: ['SZ-DWS04', 'SZ-DWS04N_SF'],
        model: 'SZ-DWS04',
        vendor: 'Sercomm',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.temperature, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.temperature(), e.battery()],
    },
    {
        zigbeeModel: ['SZ-DWS08N'],
        model: 'SZ-DWS08',
        vendor: 'Sercomm',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.temperature, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.temperature(), e.battery()],
    },
    {
        zigbeeModel: ['SZ-PIR02_SF', 'SZ-PIR02'],
        model: 'AL-PIR02',
        vendor: 'Sercomm',
        description: 'PIR motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.occupancy(), e.battery_low(), e.tamper(), e.battery()],
    },

    // Universal Electronics Inc
    {
        zigbeeModel: ['URC4460BC0-X-R'],
        model: 'XHS2-UE',
        vendor: 'Universal Electronics Inc',
        description: 'Magnetic door & window contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.temperature, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2100'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
        },
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.temperature(), e.battery()],
    },

    // Leedarson
    {
        zigbeeModel: ['LED_GU10_OWDT'],
        model: 'ZM350STW1TCF',
        vendor: 'Leedarson',
        description: 'LED PAR16 50 GU10 tunable white',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['M350ST-W1R-01', 'A470S-A7R-04'],
        model: 'M350STW1',
        vendor: 'Leedarson',
        description: 'LED PAR16 50 GU10',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['LED_E27_ORD'],
        model: 'A806S-Q1G',
        vendor: 'Leedarson',
        description: 'LED E27 color',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['ZHA-DimmableLight'],
        model: 'A806S-Q1R',
        vendor: 'Leedarson',
        description: 'LED E27 tunable white',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['LED_E27_OWDT'],
        model: 'ZA806SQ1TCF',
        vendor: 'Leedarson',
        description: 'LED E27 tunable white',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['ZBT-CCTSwitch-D0001'],
        model: '6ARCZABZH',
        vendor: 'Leedarson',
        description: '4-Key Remote Controller',
        fromZigbee: [fz.command_on, fz.command_off, fz.legacy.CCTSwitch_D0001_on_off, fz.CCTSwitch_D0001_levelctrl,
            fz.CCTSwitch_D0001_lighting, fz.battery],
        exposes: [e.battery(), e.action(['colortemp_up_release', 'colortemp_down_release', 'on', 'off', 'brightness_up', 'brightness_down',
            'colortemp_up', 'colortemp_down', 'colortemp_up_hold', 'colortemp_down_hold'])],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
    },
    {
        zigbeeModel: ['TWGU10Bulb02UK'],
        model: '6xy-M350ST-W1Z',
        vendor: 'Leedarson',
        description: 'PAR16 tunable white',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['ZHA-PIRSensor'],
        model: '5AA-SS-ZA-H0',
        vendor: 'Leedarson',
        description: 'Motion sensor',
        fromZigbee: [fz.occupancy, fz.illuminance, fz.ignore_occupancy_report],
        toZigbee: [],
        exposes: [e.occupancy(), e.illuminance(), e.illuminance_lux()],
    },

    // GMY
    {
        zigbeeModel: ['CCT box'],
        model: 'B07KG5KF5R',
        vendor: 'GMY Smart Bulb',
        description: 'GMY Smart bulb, 470lm, vintage dimmable, 2700-6500k, E27',
        extend: preset.light_onoff_brightness_colortemp(),
    },

    // Meazon
    {
        zigbeeModel: ['101.301.001649', '101.301.001838', '101.301.001802', '101.301.001738', '101.301.001412', '101.301.001765',
            '101.301.001814'],
        model: 'MEAZON_BIZY_PLUG',
        vendor: 'Meazon',
        description: 'Bizy plug meter',
        fromZigbee: [fz.command_on, fz.legacy.genOnOff_cmdOn, fz.command_off, fz.legacy.genOnOff_cmdOff, fz.on_off, fz.meazon_meter],
        exposes: [e.switch(), e.power(), e.voltage(), e.current()],
        toZigbee: [tz.on_off],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(10);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint, {min: 1, max: 0xfffe});
            const options = {manufacturerCode: 4406, disableDefaultResponse: false};
            await endpoint.write('seMetering', {0x1005: {value: 0x063e, type: 25}}, options);
            await endpoint.configureReporting('seMetering', [{reportableChange: 1,
                attribute: {ID: 0x2000, type: 0x29}, minimumReportInterval: 1, maximumReportInterval: repInterval.MINUTES_5}], options);
        },
    },
    {
        zigbeeModel: ['102.106.000235', '102.106.001111', '102.106.000348', '102.106.000256', '102.106.001242', '102.106.000540'],
        model: 'MEAZON_DINRAIL',
        vendor: 'Meazon',
        description: 'DinRail 1-phase meter',
        fromZigbee: [fz.command_on, fz.legacy.genOnOff_cmdOn, fz.command_off, fz.legacy.genOnOff_cmdOff, fz.on_off, fz.meazon_meter],
        exposes: [e.switch(), e.power(), e.voltage(), e.current()],
        toZigbee: [tz.on_off],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(10);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            const options = {manufacturerCode: 4406, disableDefaultResponse: false};
            await endpoint.write('seMetering', {0x1005: {value: 0x063e, type: 25}}, options);
            await reporting.onOff(endpoint);
            await endpoint.configureReporting('seMetering', [{attribute: {ID: 0x2000, type: 0x29},
                minimumReportInterval: 1, maximumReportInterval: repInterval.MINUTES_5, reportableChange: 1}], options);
        },
    },

    // Konke
    {
        zigbeeModel: ['3AFE170100510001', '3AFE280100510001'],
        model: '2AJZ4KPKEY',
        vendor: 'Konke',
        description: 'Multi-function button',
        fromZigbee: [fz.konke_action, fz.battery, fz.legacy.konke_click],
        exposes: [e.battery(), e.action(['single', 'double', 'hold'])],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2500'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryVoltage(endpoint);
        },
    },
    {
        zigbeeModel: ['3AFE14010402000D', '3AFE27010402000D', '3AFE28010402000D'],
        model: '2AJZ4KPBS',
        vendor: 'Konke',
        description: 'Motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1_with_timeout, fz.battery],
        toZigbee: [],
        meta: {battery: {voltageToPercentage: '3V_2500'}},
        exposes: [e.occupancy(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['3AFE140103020000', '3AFE220103020000'],
        model: '2AJZ4KPFT',
        vendor: 'Konke',
        description: 'Temperature and humidity sensor',
        fromZigbee: [fz.temperature, fz.humidity, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2500'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'msTemperatureMeasurement']);
            await reporting.batteryVoltage(endpoint);
            await reporting.temperature(endpoint);
        },
        exposes: [e.temperature(), e.humidity(), e.battery()],
    },
    {
        zigbeeModel: ['3AFE010104020028'],
        model: 'TW-S1',
        description: 'Photoelectric smoke detector',
        vendor: 'Konke',
        fromZigbee: [fz.ias_smoke_alarm_1],
        toZigbee: [],
        exposes: [e.smoke(), e.battery_low()],
    },
    {
        zigbeeModel: ['3AFE130104020015', '3AFE270104020015', '3AFE280104020015'],
        model: '2AJZ4KPDR',
        vendor: 'Konke',
        description: 'Contact sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.battery],
        toZigbee: [],
        meta: {battery: {voltageToPercentage: '3V_2500'}},
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['LH07321'],
        model: 'LH07321',
        vendor: 'Konke',
        description: 'Water detector',
        fromZigbee: [fz.ias_water_leak_alarm_1],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper()],
    },

    // Zemismart
    {
        zigbeeModel: ['NUET56-DL27LX1.1'],
        model: 'LXZB-12A',
        vendor: 'Zemismart',
        description: 'RGB LED downlight',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['LXT56-LS27LX1.6'],
        model: 'HGZB-DLC4-N15B',
        vendor: 'Zemismart',
        description: 'RGB LED downlight',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['TS0302'],
        model: 'ZM-CSW032-D',
        vendor: 'Zemismart',
        description: 'Curtain/roller blind switch',
        fromZigbee: [fz.ignore_basic_report, fz.ZMCSW032D_cover_position],
        toZigbee: [tz.cover_state, tz.ZMCSW032D_cover_position],
        exposes: [e.cover_position()],
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresWindowCovering']);
            // Configure reporing of currentPositionLiftPercentage always fails.
            // https://github.com/Koenkk/zigbee2mqtt/issues/3216
        },
    },
    {
        zigbeeModel: ['TS0003'],
        model: 'ZM-L03E-Z',
        vendor: 'Zemismart',
        description: 'Smart light switch - 3 gang with neutral wire',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('left'), e.switch().withEndpoint('center'), e.switch().withEndpoint('right')],
        endpoint: (device) => {
            return {'left': 1, 'center': 2, 'right': 3};
        },
        meta: {configureKey: 1, multiEndpoint: true, disableDefaultResponse: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(3), coordinatorEndpoint, ['genOnOff']);
        },
    },

    // Sinope
    ...require('./devices/sinope'),

    // Lutron
    {
        zigbeeModel: ['LZL4BWHL01 Remote'],
        model: 'LZL4BWHL01',
        vendor: 'Lutron',
        description: 'Connected bulb remote control',
        fromZigbee: [fz.legacy.insta_down_hold, fz.legacy.insta_up_hold, fz.legacy.LZL4B_onoff, fz.legacy.insta_stop],
        toZigbee: [],
        exposes: [e.action(['down', 'up', 'stop'])],
    },
    {
        zigbeeModel: ['Z3-1BRL'],
        model: 'Z3-1BRL',
        vendor: 'Lutron',
        description: 'Aurora smart bulb dimmer',
        fromZigbee: [fz.legacy.dimmer_passthru_brightness],
        toZigbee: [],
        exposes: [e.action(['brightness']), exposes.numeric('brightness', ea.STATE)],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genLevelCtrl']);
        },
        ota: ota.zigbeeOTA,
    },

    // Zen
    {
        zigbeeModel: ['Zen-01'],
        model: 'Zen-01-W',
        vendor: 'Zen',
        description: 'Thermostat',
        fromZigbee: [fz.battery, fz.legacy.thermostat_att_report],
        toZigbee: [tz.factory_reset, tz.thermostat_local_temperature, tz.thermostat_local_temperature_calibration,
            tz.thermostat_occupancy, tz.thermostat_occupied_heating_setpoint, tz.thermostat_occupied_cooling_setpoint,
            tz.thermostat_unoccupied_heating_setpoint, tz.thermostat_setpoint_raise_lower, tz.thermostat_running_state,
            tz.thermostat_remote_sensing, tz.thermostat_control_sequence_of_operation, tz.thermostat_system_mode,
            tz.thermostat_weekly_schedule, tz.thermostat_clear_weekly_schedule, tz.thermostat_relay_status_log],
        exposes: [exposes.climate().withSetpoint('occupied_heating_setpoint', 10, 30, 0.5).withLocalTemperature()
            .withSystemMode(['off', 'auto', 'heat']).withRunningState(['idle', 'heat', 'cool'])
            .withLocalTemperatureCalibration().withPiHeatingDemand()],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(3) || device.getEndpoint(1);
            const binds = ['genBasic', 'genIdentify', 'genPowerCfg', 'genTime', 'hvacThermostat', 'hvacUserInterfaceCfg'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);

            await reporting.thermostatSystemMode(endpoint);
            await reporting.batteryVoltage(endpoint);
            await reporting.thermostatTemperature(endpoint);
            await reporting.thermostatRunningState(endpoint);
            await reporting.thermostatOccupiedHeatingSetpoint(endpoint);
        },
    },

    // Hej
    ...require('./devices/hej'),

    // Ecolink
    {
        zigbeeModel: ['4655BC0-R'],
        model: '4655BC0-R',
        vendor: 'Ecolink',
        description: 'Contact sensor',
        fromZigbee: [fz.temperature, fz.ias_contact_alarm_1],
        toZigbee: [],
        exposes: [e.temperature(), e.contact(), e.battery_low(), e.tamper()],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement']);
            await reporting.temperature(endpoint);
        },
    },

    // AwoX
    {
        zigbeeModel: ['TLSR82xx'],
        model: '33951/33948',
        vendor: 'AwoX',
        description: 'LED white',
        extend: preset.light_onoff_brightness(),
    },
    {
        fingerprint: [
            {type: 'Router', manufacturerName: 'AwoX', modelID: 'TLSR82xx', endpoints: [
                {ID: 1, profileID: 260, deviceID: 258, inputClusters: [0, 3, 4, 5, 6, 8, 768, 4096], outputClusters: [6, 25]},
                {ID: 3, profileID: 49152, deviceID: 258, inputClusters: [65360, 65361], outputClusters: [65360, 65361]},
            ]},
        ],
        model: '33943',
        vendor: 'AwoX',
        description: 'LED RGB & brightness',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        fingerprint: [
            {type: 'Router', manufacturerName: 'AwoX', modelID: 'TLSR82xx', endpoints: [
                {ID: 1, profileID: 260, deviceID: 269, inputClusters: [0, 3, 4, 5, 6, 8, 768, 4096, 64599], outputClusters: [6]},
                {ID: 3, profileID: 4751, deviceID: 269, inputClusters: [65360, 65361], outputClusters: [65360, 65361]},
            ]},
        ],
        model: '33944',
        vendor: 'AwoX',
        description: 'LED E27 light with color and color temperature',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        fingerprint: [
            {type: 'Router', manufacturerName: 'AwoX', modelID: 'TLSR82xx', endpoints: [
                {ID: 1, profileID: 260, deviceID: 268, inputClusters: [0, 3, 4, 5, 6, 8, 768, 4096, 64599], outputClusters: [6]},
                {ID: 3, profileID: 4751, deviceID: 268, inputClusters: [65360, 65361], outputClusters: [65360, 65361]},
            ]},
        ],
        model: '33957',
        vendor: 'AwoX',
        description: 'LED light with color temperature',
        extend: preset.light_onoff_brightness_colortemp(),
    },

    // Dawon DNS
    ...require('./devices/dawon_dns'),

    // CREE
    {
        zigbeeModel: ['Connected A-19 60W Equivalent ', 'Connected A-19 60W Equivalent   '],
        model: 'B00TN589ZG',
        vendor: 'CREE',
        description: 'Connected bulb',
        extend: preset.light_onoff_brightness(),
    },

    // Ubisys
    ...require('./devices/ubisys'),

    // PEQ
    {
        zigbeeModel: ['3300'],
        model: '3300-P',
        vendor: 'PEQ',
        description: 'Door & window contact sensor',
        fromZigbee: [fz.temperature, fz.ias_contact_alarm_1, fz.battery],
        toZigbee: [],
        meta: {configureKey: 1, battery: {voltageToPercentage: '3V_2500'}},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['msTemperatureMeasurement', 'genPowerCfg']);
            await reporting.temperature(endpoint);
            await reporting.batteryVoltage(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.temperature(), e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },

    // iHORN
    {
        zigbeeModel: ['113D'],
        model: 'LH-32ZB',
        vendor: 'iHORN',
        description: 'Temperature & humidity sensor',
        fromZigbee: [fz.humidity, fz.temperature, fz.battery],
        toZigbee: [],
        exposes: [e.humidity(), e.temperature(), e.battery()],
    },
    {
        zigbeeModel: ['113C'],
        model: 'LH-992ZB',
        vendor: 'iHORN',
        description: 'Motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['TI0001 '],
        model: 'LH-990ZB',
        vendor: 'iHORN',
        description: 'PIR motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['HORN-MECI-A3.9-E'],
        model: 'HO-09ZB',
        vendor: 'iHORN',
        description: 'Door or window contact switch',
        fromZigbee: [fz.ias_contact_alarm_1, fz.battery],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['HORN-PIR--A3.9-E'],
        model: 'LH-990F',
        vendor: 'iHORN',
        description: 'PIR motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low(), e.tamper()],
    },

    // TCI
    {
        zigbeeModel: ['VOLARE ZB3\u0000\u0000\u0000\u0000\u0000\u0000\u0000'],
        model: '676-00301024955Z',
        vendor: 'TCI',
        description: 'Dash L DC Volare',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['MAXI JOLLY ZB3'],
        model: '151570',
        vendor: 'TCI',
        description: 'LED driver for wireless control (60 watt)',
        extend: preset.light_onoff_brightness(),
    },

    // TERNCY
    {
        zigbeeModel: ['TERNCY-DC01'],
        model: 'TERNCY-DC01',
        vendor: 'TERNCY',
        description: 'Temperature & contact sensor ',
        fromZigbee: [fz.terncy_temperature, fz.terncy_contact, fz.battery],
        toZigbee: [],
        exposes: [e.temperature(), e.contact(), e.battery()],
        meta: {battery: {dontDividePercentage: true}},
    },
    {
        zigbeeModel: ['TERNCY-PP01'],
        model: 'TERNCY-PP01',
        vendor: 'TERNCY',
        description: 'Awareness switch',
        fromZigbee: [fz.terncy_temperature, fz.occupancy_with_timeout, fz.illuminance, fz.terncy_raw, fz.legacy.terncy_raw, fz.battery],
        exposes: [e.temperature(), e.occupancy(), e.illuminance_lux(), e.illuminance(),
            e.action(['single', 'double', 'triple', 'quadruple'])],
        toZigbee: [],
        meta: {battery: {dontDividePercentage: true}},
    },
    {
        zigbeeModel: ['TERNCY-SD01'],
        model: 'TERNCY-SD01',
        vendor: 'TERNCY',
        description: 'Knob smart dimmer',
        fromZigbee: [fz.terncy_raw, fz.legacy.terncy_raw, fz.legacy.terncy_knob, fz.battery],
        toZigbee: [],
        ota: ota.zigbeeOTA,
        meta: {battery: {dontDividePercentage: true}},
        exposes: [e.battery(), e.action(['single', 'double', 'triple', 'quadruple', 'rotate']),
            exposes.text('direction', ea.STATE)],
    },
    {
        zigbeeModel: ['TERNCY-LS01'],
        model: 'TERNCY-LS01',
        vendor: 'TERNCY',
        description: 'Smart light socket',
        exposes: [e.switch(), e.action(['single'])],
        fromZigbee: [fz.on_off, fz.terncy_raw, fz.ignore_basic_report],
        toZigbee: [tz.on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
        },
    },

    // ORVIBO
    ...require('./devices/orvibo'),

    // Yookee
    {
        zigbeeModel: ['D10110'],
        model: 'D10110',
        vendor: 'Yookee',
        description: 'Smart blind controller',
        fromZigbee: [fz.cover_position_tilt, fz.battery],
        toZigbee: [tz.cover_state, tz.cover_position_tilt],
        meta: {configureKey: 1, coverInverted: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'closuresWindowCovering']);
            await reporting.batteryPercentageRemaining(endpoint);
            await reporting.currentPositionLiftPercentage(endpoint);
        },
        exposes: [e.cover_position(), e.battery()],
    },

    // SONOFF
    ...require('./devices/sonoff'),

    // eWeLink
    {
        zigbeeModel: ['SA-003-Zigbee'],
        model: 'SA-003-Zigbee',
        vendor: 'eWeLink',
        description: 'Zigbee smart plug',
        extend: preset.switch(),
        fromZigbee: [fz.on_off_skip_duplicate_transaction],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
        },
        onEvent: async (type, data, device) => {
            device.skipDefaultResponse = true;
        },
    },
    {
        zigbeeModel: ['ZB-SW01'],
        model: 'ZB-SW01',
        vendor: 'eWeLink',
        description: 'Smart light switch - 1 gang',
        extend: preset.switch(),
        fromZigbee: [fz.on_off_skip_duplicate_transaction],
        onEvent: async (type, data, device) => {
            device.skipDefaultResponse = true;
        },
    },
    {
        zigbeeModel: ['ZB-SW02', 'E220-KR2N0Z0-HA'],
        model: 'ZB-SW02',
        vendor: 'eWeLink',
        description: 'Smart light switch - 2 gang',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('left'), e.switch().withEndpoint('right')],
        endpoint: (device) => {
            return {'left': 1, 'right': 2};
        },
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
        },
        onEvent: async (type, data, device) => {
            device.skipDefaultResponse = true;
        },
    },
    {
        zigbeeModel: ['ZB-SW03'],
        model: 'ZB-SW03',
        vendor: 'eWeLink',
        description: 'Smart light switch - 3 gang',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('left'), e.switch().withEndpoint('center'), e.switch().withEndpoint('right')],
        endpoint: (device) => {
            return {'left': 1, 'center': 2, 'right': 3};
        },
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(3), coordinatorEndpoint, ['genOnOff']);
        },
        onEvent: async (type, data, device) => {
            device.skipDefaultResponse = true;
        },
    },

    // CR Smart Home
    {
        fingerprint: [{modelID: 'TS0202', manufacturerName: '_TYZB01_jytabjkb'}],
        model: 'TS0202_CR',
        vendor: 'CR Smart Home',
        description: 'Motion sensor',
        // Requires alarm_1_with_timeout https://github.com/Koenkk/zigbee2mqtt/issues/2818#issuecomment-776119586
        fromZigbee: [fz.ias_occupancy_alarm_1_with_timeout, fz.battery, fz.ignore_basic_report],
        toZigbee: [],
        exposes: [e.occupancy(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['TS0203'],
        model: 'TS0203',
        vendor: 'CR Smart Home',
        description: 'Door sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.battery, fz.ignore_basic_report, fz.ias_contact_alarm_1_report],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['TS0204'],
        model: 'TS0204',
        vendor: 'CR Smart Home',
        description: 'Gas sensor',
        fromZigbee: [fz.ias_gas_alarm_1, fz.battery, fz.ignore_basic_report],
        toZigbee: [],
        exposes: [e.gas(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['TS0205'],
        model: 'TS0205',
        vendor: 'CR Smart Home',
        description: 'Smoke sensor',
        fromZigbee: [fz.ias_smoke_alarm_1, fz.battery, fz.ignore_basic_report],
        toZigbee: [],
        exposes: [e.smoke(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['TS0111'],
        model: 'TS0111',
        vendor: 'CR Smart Home',
        description: 'Socket',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['TS0207', 'FNB54-WTS08ML1.0'],
        model: 'TS0207',
        vendor: 'CR Smart Home',
        description: 'Water leak detector',
        fromZigbee: [fz.ias_water_leak_alarm_1, fz.battery],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['TS0218'],
        model: 'TS0218',
        vendor: 'CR Smart Home',
        description: 'Button',
        fromZigbee: [fz.legacy.TS0218_click, fz.battery],
        exposes: [e.battery(), e.action(['click'])],
        toZigbee: [],
    },

    // EcoDim
    {
        zigbeeModel: ['Dimmer-Switch-ZB3.0'],
        model: 'Eco-Dim.07',
        vendor: 'EcoDim',
        description: 'Zigbee & Z-wave dimmer ',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
            await reporting.brightness(endpoint);
        },
    },

    // EcoDim
    {
        zigbeeModel: ['ED-10010'],
        model: 'ED-10010',
        vendor: 'EcoDim',
        description: 'Zigbee 2 button wall switch - white',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on', 'off', 'brightness_move_up', 'brightness_move_down', 'brightness_stop'])],
        toZigbee: [],
        meta: {multiEndpoint: true},
    },
    {
        zigbeeModel: ['ED-10011'],
        model: 'ED-10011',
        vendor: 'EcoDim',
        description: 'Zigbee 2 button wall switch - black',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on', 'off', 'brightness_move_up', 'brightness_move_down', 'brightness_stop'])],
        toZigbee: [],
        meta: {multiEndpoint: true},
    },
    {
        zigbeeModel: ['ED-10012'],
        model: 'ED-10012',
        vendor: 'EcoDim',
        description: 'Zigbee 4 button wall switch - white',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on_1', 'off_1', 'brightness_move_up_1', 'brightness_move_down_1', 'brightness_stop_1',
            'on_2', 'off_2', 'brightness_move_up_2', 'brightness_move_down_2', 'brightness_stop_2'])],
        toZigbee: [],
        meta: {multiEndpoint: true},
    },
    {
        zigbeeModel: ['ED-10013'],
        model: 'ED-10013',
        vendor: 'EcoDim',
        description: 'Zigbee 4 button wall switch - black',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on_1', 'off_1', 'brightness_move_up_1', 'brightness_move_down_1', 'brightness_stop_1',
            'on_2', 'off_2', 'brightness_move_up_2', 'brightness_move_down_2', 'brightness_stop_2'])],
        toZigbee: [],
        meta: {multiEndpoint: true},
    },
    {
        zigbeeModel: ['ED-10014'],
        model: 'ED-10014',
        vendor: 'EcoDim',
        description: 'Zigbee 8 button wall switch - white',
        supports: '',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on_1', 'off_1', 'brightness_move_up_1', 'brightness_move_down_1', 'brightness_stop_1',
            'on_2', 'off_2', 'brightness_move_up_2', 'brightness_move_down_2', 'brightness_stop_2', 'on_3', 'off_3',
            'brightness_move_up_3', 'brightness_move_down_3', 'brightness_stop_3', 'on_4', 'off_4', 'brightness_move_up_4',
            'brightness_move_down_4', 'brightness_stop_4'])],
        toZigbee: [],
        meta: {multiEndpoint: true, battery: {dontDividePercentage: true}},
    },
    {
        zigbeeModel: ['ED-10015'],
        model: 'ED-10015',
        vendor: 'EcoDim',
        description: 'Zigbee 8 button wall switch - black',
        supports: '',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on_1', 'off_1', 'brightness_move_up_1', 'brightness_move_down_1', 'brightness_stop_1',
            'on_2', 'off_2', 'brightness_move_up_2', 'brightness_move_down_2', 'brightness_stop_2', 'on_3', 'off_3', 'brightness_move_up_3',
            'brightness_move_down_3', 'brightness_stop_3', 'on_4', 'off_4', 'brightness_move_up_4', 'brightness_move_down_4',
            'brightness_stop_4'])],
        toZigbee: [],
        meta: {multiEndpoint: true, battery: {dontDividePercentage: true}},
    },

    // Smart9
    {
        zigbeeModel: ['TS0215'],
        model: 'S9ZGBRC01',
        vendor: 'Smart9',
        description: 'Smart remote controller',
        fromZigbee: [fz.command_arm, fz.command_emergency, fz.battery],
        toZigbee: [],
        exposes: [e.battery(), e.action(['disarm', 'arm_day_zones', 'arm_night_zones', 'arm_all_zones', 'exit_delay', 'emergency'])],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
        },
        onEvent: async (type, data, device) => {
            // Since arm command has a response zigbee-herdsman doesn't send a default response.
            // This causes the remote to repeat the arm command, so send a default response here.
            if (data.type === 'commandArm' && data.cluster === 'ssIasAce') {
                await data.endpoint.defaultResponse(0, 0, 1281, data.meta.zclTransactionSequenceNumber);
            }
        },
    },

    // Ajax Online
    {
        zigbeeModel: ['AJ-RGBCCT 5 in 1'],
        model: 'Aj_Zigbee_Led_Strip',
        vendor: 'Ajax Online',
        description: 'LED Strip',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['AJ_ZB30_GU10', 'AJ_ZB120_GU10'],
        model: 'AJ_ZB_GU10',
        vendor: 'Ajax Online',
        description: 'Smart Zigbee pro GU10 spotlight bulb',
        extend: preset.light_onoff_brightness_colortemp_color({colorTempRange: [158, 495], disableEffect: true}),
    },

    // Moes
    ...require('./devices/moes'),

    // HGKG
    {
        fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_dzuqwsyg'}],
        model: 'BAC-002-ALZB',
        vendor: 'HKGK',
        description: 'BAC series thermostat',
        fromZigbee: [fz.moes_thermostat],
        toZigbee: [tz.moes_thermostat_child_lock, tz.moes_thermostat_current_heating_setpoint, tz.moes_thermostat_mode,
            tz.hgkg_thermostat_standby, tz.moes_thermostat_sensor, tz.moes_thermostat_calibration,
            tz.moes_thermostat_deadzone_temperature, tz.moes_thermostat_max_temperature_limit],
        exposes: [e.child_lock(), e.deadzone_temperature(), e.max_temperature_limit(),
            exposes.climate().withSetpoint('current_heating_setpoint', 5, 30, 1, ea.STATE_SET)
                .withLocalTemperature(ea.STATE).withLocalTemperatureCalibration(ea.STATE_SET)
                .withSystemMode(['off', 'cool'], ea.STATE_SET).withRunningState(['idle', 'heat', 'cool'], ea.STATE)
                .withPreset(['hold', 'program']).withSensor(['IN', 'AL', 'OU'], ea.STATE_SET)],
        onEvent: tuya.onEventSetLocalTime,
    },

    // Schneider Electric
    ...require('./devices/schneider_electric'),

    // Legrand
    ...require('./devices/legrand'),

    // BTicino
    {
        zigbeeModel: [' Light switch with neutral\u0000\u0000\u0000\u0000\u0000'],
        model: 'K4003C/L4003C/N4003C/NT4003C',
        vendor: 'BTicino',
        description: 'Light switch with neutral',
        fromZigbee: [fz.identify, fz.on_off, fz.K4003C_binary_input],
        toZigbee: [tz.on_off, tz.legrand_settingAlwaysEnableLed, tz.legrand_settingEnableLedIfOn, tz.legrand_identify],
        exposes: [e.switch(), e.action(['identify', 'on', 'off'])],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genIdentify', 'genOnOff', 'genBinaryInput']);
        },
    },
    {
        zigbeeModel: [' Dimmer switch with neutral\u0000\u0000\u0000\u0000'],
        model: 'L441C/N4411C/NT4411C',
        vendor: 'BTicino',
        description: 'Dimmer switch with neutral',
        extend: preset.light_onoff_brightness(),
        exposes: [e.light_brightness()],
        fromZigbee: [fz.brightness, fz.identify, fz.on_off],
        toZigbee: [tz.light_onoff_brightness, tz.legrand_settingAlwaysEnableLed, tz.legrand_settingEnableLedIfOn,
            tz.legrand_settingEnableDimmer, tz.legrand_identify],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genIdentify', 'genOnOff', 'genLevelCtrl', 'genBinaryInput']);
            await reporting.onOff(endpoint);
            await reporting.brightness(endpoint);
        },
    },
    {
        // Newer firmwares (e.g. 001f) Does support partial position reporting
        // Old firmware of this device provides only three values: 0, 100 and 50, 50 means an idefinite position between 1 and 99.
        // If you have an old Firmware set no_position_support to true
        // https://github.com/Koenkk/zigbee-herdsman-converters/pull/2214 - 1st very basic support
        zigbeeModel: [' Shutter SW with level control\u0000'],
        model: 'K4027C/L4027C/N4027C/NT4027C',
        vendor: 'BTicino',
        description: 'Shutter SW with level control',
        fromZigbee: [fz.identify, fz.ignore_basic_report, fz.ignore_zclversion_read, fz.bticino_4027C_binary_input_moving,
            fz.cover_position_tilt],
        toZigbee: [tz.bticino_4027C_cover_state, tz.bticino_4027C_cover_position, tz.legrand_identify,
            tz.legrand_settingAlwaysEnableLed],
        exposes: [e.cover_position()],
        meta: {configureKey: 1, coverInverted: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genBinaryInput', 'closuresWindowCovering', 'genIdentify']);
        },
    },
    {
        zigbeeModel: ['Bticino Din power consumption module '],
        model: 'F20T60A',
        description: 'DIN power consumption module',
        vendor: 'BTicino',
        extend: preset.switch(),
        fromZigbee: [fz.identify, fz.on_off, fz.electrical_measurement, fz.legrand_device_mode, fz.ignore_basic_report, fz.ignore_genOta],
        toZigbee: [tz.legrand_deviceMode, tz.on_off, tz.legrand_identify, tz.electrical_measurement_power],
        exposes: [exposes.switch().withState('state', true, 'On/off (works only if device is in "switch" mode)'),
            e.power().withAccess(ea.STATE_GET), exposes.enum( 'device_mode', ea.ALL, ['switch', 'auto'])
                .withDescription('switch: allow on/off, auto will use wired action via C1/C2 on contactor for example with HC/HP')],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genIdentify', 'genOnOff', 'haElectricalMeasurement']);
            await reporting.onOff(endpoint);
            await reporting.readEletricalMeasurementMultiplierDivisors(endpoint);
            await reporting.activePower(endpoint);
        },
    },
    {
        zigbeeModel: ['Power socket Bticino Serie LL '],
        model: 'L4531C',
        vendor: 'BTicino',
        description: 'Power socket with power consumption monitoring',
        fromZigbee: [fz.identify, fz.on_off, fz.electrical_measurement],
        toZigbee: [tz.on_off, tz.legrand_settingAlwaysEnableLed, tz.legrand_identify],
        exposes: [e.switch(), e.action(['identify']), e.power(), e.voltage(), e.current()],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genIdentify', 'genOnOff', 'haElectricalMeasurement']);
            await reporting.onOff(endpoint);
            await reporting.readEletricalMeasurementMultiplierDivisors(endpoint);
            await reporting.activePower(endpoint);
        },
    },

    // Linkind
    ...require('./devices/linkind'),

    // BlitzWolf
    {
        zigbeeModel: ['5j6ifxj'],
        model: 'BW-IS3',
        vendor: 'BlitzWolf',
        description: 'Rechargeable Zigbee PIR motion sensor',
        fromZigbee: [fz.blitzwolf_occupancy_with_timeout],
        toZigbee: [],
        exposes: [e.occupancy()],
    },
    {

        fingerprint: [{modelID: 'TS0003', manufacturerName: '_TYZB01_aneiicmq'}],
        model: 'BW-SS7_1gang',
        vendor: 'BlitzWolf',
        description: 'Zigbee 3.0 smart light switch module 1 gang',
        extend: preset.switch(),
        toZigbee: [tz.TYZB01_on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
        },
    },
    {
        fingerprint: [{modelID: 'TS0003', manufacturerName: '_TYZB01_digziiav'}],
        model: 'BW-SS7_2gang',
        vendor: 'BlitzWolf',
        description: 'Zigbee 3.0 smart light switch module 2 gang',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('l1'), e.switch().withEndpoint('l2')],
        endpoint: (device) => {
            return {'l1': 1, 'l2': 2};
        },
        toZigbee: [tz.TYZB01_on_off],
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
        },
    },

    // Kwikset
    {
        zigbeeModel: ['SMARTCODE_CONVERT_GEN1'],
        model: '66492-001',
        vendor: 'Kwikset',
        description: 'Home connect smart lock conversion kit',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery],
        toZigbee: [tz.lock],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(2);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },
    {
        zigbeeModel: ['SMARTCODE_DEADBOLT_10_L'],
        model: '99140-002',
        vendor: 'Kwikset',
        description: 'SmartCode traditional electronic deadbolt',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery],
        toZigbee: [tz.lock],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(2);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },
    {
        zigbeeModel: ['SMARTCODE_DEADBOLT_5'],
        model: '99100-045',
        vendor: 'Kwikset',
        description: '910 SmartCode traditional electronic deadbolt',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery, fz.lock_programming_event, fz.lock_pin_code_response],
        toZigbee: [tz.lock, tz.pincode_lock],
        meta: {configureKey: 4, pinCodeCount: 30},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(2);
            console.log(device);
            console.log(endpoint.clusters);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },
    {
        zigbeeModel: ['SMARTCODE_DEADBOLT_5_L'],
        model: '99100-006',
        vendor: 'Kwikset',
        description: '910 SmartCode traditional electronic deadbolt',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery],
        toZigbee: [tz.lock],
        meta: {configureKey: 4},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(2);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },

    // Schlage
    {
        zigbeeModel: ['BE468'],
        model: 'BE468',
        vendor: 'Schlage',
        description: 'Connect smart deadbolt',
        fromZigbee: [fz.lock, fz.lock_operation_event, fz.battery],
        toZigbee: [tz.lock],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.endpoints[0];
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery()],
    },

    // HORNBACH
    {
        zigbeeModel: ['VIYU-A60-806-RGBW-10011725'],
        model: '10011725',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart LED bulb RGB E27',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['VIYU_C35_470_RGBW_10297667'],
        model: '10297667',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart LED bulb RGB E14',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['VIYU-A60-806-CCT-10011723'],
        model: '10011723',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart LED bulb CCT E27',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['VIYU-C35-470-CCT-10011722'],
        model: '10011722',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart LED candle CCT E14',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['VIYU_GU10_350_RGBW_10297666'],
        model: '10297666',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart GU10 RGBW lamp',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['VIYU-GU10-350-CCT-10011724'],
        model: '10011724',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart GU10 CCT lamp',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['VIYU_A60_470_FI_D_CCT_10297665'],
        model: '10297665',
        vendor: 'HORNBACH',
        description: 'FLAIR Viyu Smart LED bulb CCT E27 filament',
        extend: preset.light_onoff_brightness_colortemp({colorTempRange: [250, 454]}),
    },

    // LifeControl
    {
        zigbeeModel: ['Leak_Sensor'],
        model: 'MCLH-07',
        vendor: 'LifeControl',
        description: 'Water leak switch',
        fromZigbee: [fz.ias_water_leak_alarm_1, fz.battery],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['Door_Sensor'],
        model: 'MCLH-04',
        vendor: 'LifeControl',
        description: 'Door sensor',
        fromZigbee: [fz.ias_contact_alarm_1, fz.battery],
        toZigbee: [],
        exposes: [e.contact(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['vivi ZLight'],
        model: 'MCLH-02',
        vendor: 'LifeControl',
        description: 'RGB LED lamp',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['RICI01'],
        model: 'MCLH-03',
        vendor: 'LifeControl',
        description: 'Power plug',
        fromZigbee: [fz.on_off, fz.electrical_measurement],
        toZigbee: [tz.on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement']);
            await reporting.onOff(endpoint);
            await reporting.readEletricalMeasurementMultiplierDivisors(endpoint);
        },
        onEvent: async (type, data, device) => {
            // This device doesn't support reporting correctly.
            // https://github.com/Koenkk/zigbee-herdsman-converters/pull/1270
            const endpoint = device.getEndpoint(1);
            if (type === 'stop') {
                clearInterval(globalStore.getValue(device, 'interval'));
                globalStore.clearValue(device, 'interval');
            } else if (!globalStore.hasValue(device, 'interval')) {
                const interval = setInterval(async () => {
                    try {
                        await endpoint.read('haElectricalMeasurement', ['rmsVoltage', 'rmsCurrent', 'activePower']);
                    } catch (error) {
                        // Do nothing
                    }
                }, 10*1000); // Every 10 seconds
                globalStore.putValue(device, 'interval', interval);
            }
        },
        exposes: [e.switch(), e.power(), e.current(), e.voltage()],
    },
    {
        zigbeeModel: ['Motion_Sensor'],
        model: 'MCLH-05',
        vendor: 'LifeControl',
        description: 'Motion sensor',
        fromZigbee: [fz.ias_occupancy_alarm_1, fz.battery],
        toZigbee: [],
        meta: {battery: {dontDividePercentage: true}},
        exposes: [e.occupancy(), e.battery_low(), e.tamper(), e.battery()],
    },
    {
        zigbeeModel: ['VOC_Sensor'],
        model: 'MCLH-08',
        vendor: 'LifeControl',
        description: 'Air sensor',
        fromZigbee: [fz.lifecontrolVoc],
        toZigbee: [],
        exposes: [e.temperature(), e.humidity(), e.voc(), e.eco2()],
    },

    // Develco
    ...require('./devices/develco'),

    // Aurora Lighting
    ...require('./devices/aurora_lighting'),

    // Wally
    {
        zigbeeModel: ['MultiSensor'],
        model: 'U02I007C.01',
        vendor: 'Wally',
        description: 'WallyHome multi-sensor',
        fromZigbee: [fz.command_on, fz.command_off, fz.battery, fz.temperature, fz.humidity, fz.U02I007C01_contact,
            fz.U02I007C01_water_leak],
        exposes: [e.battery(), e.temperature(), e.humidity(), e.action(['on', 'off']), e.contact(), e.water_leak()],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const binds = ['genPowerCfg', 'genOnOff', 'msTemperatureMeasurement', 'msRelativeHumidity'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.batteryPercentageRemaining(endpoint);
            await reporting.temperature(endpoint);
            await reporting.humidity(endpoint);
        },
    },

    // Smartenit
    {
        zigbeeModel: ['ZBMLC30'],
        model: '4040B',
        vendor: 'Smartenit',
        description: 'Wireless metering 30A dual-load switch/controller',
        fromZigbee: [fz.on_off, fz.metering, fz.ignore_light_brightness_report],
        toZigbee: [tz.on_off],
        meta: {configureKey: 2},
        endpoint: (device) => {
            return {l1: 1, l2: 2};
        },
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint1 = device.getEndpoint(1);
            await reporting.bind(endpoint1, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            const endpoint2 = device.getEndpoint(2);
            await reporting.bind(endpoint2, coordinatorEndpoint, ['genOnOff', 'seMetering']);

            // Device doesn't respond to divisor read, set it here
            // https://github.com/Koenkk/zigbee-herdsman-converters/pull/1096
            endpoint2.saveClusterAttributeKeyValue('seMetering', {
                divisor: 100000,
                multiplier: 1,
            });
        },
        exposes: [e.switch().withEndpoint('l1'), e.switch().withEndpoint('l2'), e.power(), e.energy()],
    },
    {
        zigbeeModel: ['ZBHT-1'],
        model: 'ZBHT-1',
        vendor: 'Smartenit',
        description: 'Temperature & humidity sensor ',
        fromZigbee: [fz.battery, fz.temperature, fz.humidity],
        toZigbee: [],
        exposes: [e.battery(), e.temperature(), e.humidity()],
    },

    // Siterwell
    {
        zigbeeModel: ['ivfvd7h', 'eaxp72v\u0000', 'kfvq6avy\u0000', 'fvq6avy\u0000', 'fvq6avy'],
        fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_zivfvd7h'}, {modelId: 'TS0601', manufacturerName: '_TZE200_kfvq6avy'}],
        model: 'GS361A-H04',
        vendor: 'Siterwell',
        description: 'Radiator valve with thermostat',
        fromZigbee: [fz.tuya_thermostat, fz.ignore_basic_report],
        meta: {tuyaThermostatSystemMode: tuya.thermostatSystemModes4, tuyaThermostatPreset: tuya.thermostatPresets,
            tuyaThermostatPresetToSystemMode: tuya.thermostatSystemModes4},
        toZigbee: [tz.tuya_thermostat_child_lock, tz.siterwell_thermostat_window_detection, tz.tuya_thermostat_valve_detection,
            tz.tuya_thermostat_current_heating_setpoint, tz.tuya_thermostat_system_mode, tz.tuya_thermostat_auto_lock,
            tz.tuya_thermostat_calibration, tz.tuya_thermostat_min_temp, tz.tuya_thermostat_max_temp, tz.tuya_thermostat_boost_time,
            tz.tuya_thermostat_comfort_temp, tz.tuya_thermostat_eco_temp, tz.tuya_thermostat_force, tz.tuya_thermostat_preset],
        whiteLabel: [{vendor: 'Essentials', description: 'Smart home heizkörperthermostat premium', model: '120112'},
            {vendor: 'TuYa', description: 'Głowica termostatyczna', model: 'GTZ02'},
            {vendor: 'Revolt', description: 'Thermostatic Radiator Valve Controller', model: 'NX-4911'}],
        exposes: [e.child_lock(), e.window_detection(), e.battery(), e.valve_detection(), e.position(), exposes.climate()
            .withSetpoint('current_heating_setpoint', 5, 30, 0.5, ea.STATE_SET).withLocalTemperature(ea.STATE)
            .withSystemMode(['off', 'auto', 'heat'], ea.STATE_SET)
            .withRunningState(['idle', 'heat'], ea.STATE)],
    },

    // Green Power
    {
        zigbeeModel: ['GreenPower_2'],
        model: 'GreenPower_On_Off_Switch',
        vendor: 'GreenPower',
        description: 'On/off switch',
        fromZigbee: [fz.greenpower_on_off_switch],
        exposes: [e.action([
            'identify', 'recall_scene_0', 'recall_scene_1', 'recall_scene_2', 'recall_scene_3', 'recall_scene_4', 'recall_scene_5',
            'recall_scene_6', 'recall_scene_7', 'store_scene_0', 'store_scene_1', 'store_scene_2', 'store_scene_3', 'store_scene_4',
            'store_scene_5', 'store_scene_6', 'store_scene_7', 'off', 'on', 'toggle', 'release', 'press_1_of_1', 'release_1_of_1',
            'press_1_of_2', 'release_1_of_2', 'press_2_of_2', 'release_2_of_2', 'short_press_1_of_1', 'short_press_1_of_2',
            'short_press_2_of_1'])],
        toZigbee: [],
        whiteLabel: [{vendor: 'Philips', description: 'Hue Tap', model: '8718696743133'},
            {vendor: 'Niko', description: 'Friends of Hue switch', model: '91004'}],
    },
    {
        zigbeeModel: ['GreenPower_7'],
        model: 'GreenPower_7',
        vendor: 'GreenPower',
        description: 'device 7',
        fromZigbee: [fz.greenpower_7],
        toZigbee: [],
        exposes: [e.action(['*'])],
        whiteLabel: [{vendor: 'EnOcean', description: 'Easyfit 1 or 2 gang switch', model: 'EWSxZG'}],
    },

    // EasyAccess
    {
        zigbeeModel: ['EasyCode903G2.1'],
        model: 'EasyCode903G2.1',
        vendor: 'EasyAccess',
        description: 'EasyFinger V2',
        fromZigbee: [fz.lock, fz.easycode_action, fz.battery],
        toZigbee: [tz.lock, tz.easycode_auto_relock, tz.lock_sound_volume],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(11);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresDoorLock', 'genPowerCfg']);
            await reporting.lockState(endpoint);
            await reporting.batteryPercentageRemaining(endpoint);
        },
        exposes: [e.lock(), e.battery(), e.sound_volume(),
            e.action(['zigbee_unlock', 'lock', 'rfid_unlock', 'keypad_unlock']),
            exposes.binary('auto_relock', ea.STATE_SET, true, false).withDescription('Auto relock after 7 seconds.')],
    },

    // Schwaiger
    {
        zigbeeModel: ['SPW35Z-D0'],
        model: 'ZHS-15',
        vendor: 'Schwaiger',
        description: 'Power socket on/off with power consumption monitoring',
        fromZigbee: [fz.on_off, fz.electrical_measurement],
        toZigbee: [tz.on_off],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement']);
            await reporting.onOff(endpoint);
            await reporting.readEletricalMeasurementMultiplierDivisors(endpoint);
            await reporting.rmsVoltage(endpoint);
            await reporting.rmsCurrent(endpoint);
            await reporting.activePower(endpoint);
        },
        exposes: [e.switch(), e.power(), e.current(), e.voltage()],
    },
    {
        zigbeeModel: ['ZBT-RGBWLight-GLS0844'],
        model: 'HAL300',
        vendor: 'Schwaiger',
        description: 'Tint LED bulb E27 806 lumen, dimmable, color, white 1800-6500K',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['ZBT-DIMLight-Candle0800'],
        model: 'HAL600',
        vendor: 'Schwaiger',
        description: 'LED candle bulb E14 470 lumen, dimmable, color, white 2700K',
        extend: preset.light_onoff_brightness(),
    },

    // Zipato
    {
        zigbeeModel: ['ZHA-ColorLight'],
        model: 'rgbw2.zbee27',
        vendor: 'Zipato',
        description: 'RGBW LED bulb with dimmer',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },

    // Viessmann
    {
        zigbeeModel: ['7637434'],
        model: 'ZK03840',
        vendor: 'Viessmann',
        description: 'ViCare radiator thermostat valve',
        fromZigbee: [fz.legacy.viessmann_thermostat_att_report, fz.battery, fz.legacy.hvac_user_interface],
        toZigbee: [tz.thermostat_local_temperature, tz.thermostat_occupied_heating_setpoint, tz.thermostat_control_sequence_of_operation,
            tz.thermostat_system_mode, tz.thermostat_keypad_lockout, tz.viessmann_window_open, tz.viessmann_window_open_force,
            tz.viessmann_assembly_mode,
        ],
        exposes: [
            exposes.climate().withSetpoint('occupied_heating_setpoint', 7, 30, 1)
                .withLocalTemperature().withSystemMode(['heat', 'sleep']),
            exposes.binary('window_open', ea.STATE_GET, true, false)
                .withDescription('Detected by sudden temperature drop or set manually.'),
            exposes.binary('window_open_force', ea.ALL, true, false)
                .withDescription('Manually set window_open, ~1 minute to take affect.'),
            e.keypad_lockout(),
        ],
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const options = {manufacturerCode: 0x1221};
            await reporting.bind(endpoint, coordinatorEndpoint, ['genBasic', 'genPowerCfg', 'genIdentify', 'genTime', 'hvacThermostat']);

            // standard ZCL attributes
            await reporting.batteryPercentageRemaining(endpoint, {min: 60, max: 43200, change: 1});
            await reporting.thermostatTemperature(endpoint, {min: 90, max: 900, change: 10});
            await reporting.thermostatOccupiedHeatingSetpoint(endpoint, {min: 0, max: 65534, change: 1});
            await reporting.thermostatPIHeatingDemand(endpoint, {min: 60, max: 3600, change: 1});

            // manufacturer attributes
            await endpoint.configureReporting('hvacThermostat', [{attribute: 'viessmannCustom0', minimumReportInterval: 60,
                maximumReportInterval: 3600}], options);

            // read window_open_force, we don't need reporting as it cannot be set physically on the device
            await endpoint.read('hvacThermostat', ['viessmannWindowOpenForce'], options);

            // read keypadLockout, we don't need reporting as it cannot be set physically on the device
            await endpoint.read('hvacUserInterfaceCfg', ['keypadLockout']);
        },
    },

    // Waxman
    {
        zigbeeModel: ['leakSMART Water Sensor V2'],
        model: '8840100H',
        vendor: 'Waxman',
        description: 'leakSMART water sensor v2',
        fromZigbee: [fz._8840100H_water_leak_alarm, fz.temperature, fz.battery],
        toZigbee: [],
        exposes: [e.battery(), e.temperature(), e.water_leak()],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'haApplianceEventsAlerts', 'msTemperatureMeasurement']);
            await reporting.batteryPercentageRemaining(endpoint);
            await reporting.temperature(endpoint);
        },
    },

    // eZEX
    {
        zigbeeModel: ['E220-KR3N0Z0-HA'],
        model: 'ECW-100-A03',
        vendor: 'eZEX',
        description: 'Zigbee switch 3 gang',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('top'), e.switch().withEndpoint('center'), e.switch().withEndpoint('bottom')],
        endpoint: (device) => {
            return {top: 1, center: 2, bottom: 3};
        },
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(device.getEndpoint(3), coordinatorEndpoint, ['genOnOff']);
        },
    },

    // EchoStar
    {
        zigbeeModel: ['   Bell'],
        model: 'SAGE206612',
        vendor: 'EchoStar',
        description: 'SAGE by Hughes doorbell sensor',
        fromZigbee: [fz.SAGE206612_state, fz.battery],
        exposes: [e.battery(), e.action(['bell1', 'bell2'])],
        toZigbee: [],
        meta: {battery: {voltageToPercentage: '3V_2500'}},
    },
    {
        zigbeeModel: [' Switch'],
        model: 'SAGE206611',
        vendor: 'Echostar',
        description: 'SAGE by Hughes single gang light switch',
        fromZigbee: [fz.command_on, fz.command_off, fz.battery],
        exposes: [e.battery(), e.action(['on', 'off'])],
        toZigbee: [],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(18);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg']);
            await reporting.batteryPercentageRemaining(endpoint);
        },
    },

    // Plugwise
    {
        zigbeeModel: ['160-01'],
        model: '160-01',
        vendor: 'Plugwise',
        description: 'Plug power socket on/off with power consumption monitoring',
        fromZigbee: [fz.on_off, fz.metering],
        toZigbee: [tz.on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.instantaneousDemand(endpoint);
        },
        exposes: [e.switch(), e.power(), e.energy()],
    },

    // KMPCIL
    {
        zigbeeModel: ['RES005'],
        model: 'KMPCIL_RES005',
        vendor: 'KMPCIL',
        description: 'Environment sensor',
        exposes: [e.battery(), e.temperature(), e.humidity(), e.pressure(), e.illuminance(), e.illuminance_lux(), e.occupancy(),
            e.switch()],
        fromZigbee: [fz.battery, fz.temperature, fz.humidity, fz.pressure, fz.illuminance, fz.kmpcil_res005_occupancy,
            fz.kmpcil_res005_on_off],
        toZigbee: [tz.kmpcil_res005_on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(8);
            const binds = ['genPowerCfg', 'msTemperatureMeasurement', 'msRelativeHumidity', 'msPressureMeasurement',
                'msIlluminanceMeasurement', 'genBinaryInput', 'genBinaryOutput'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.temperature(endpoint);
            await reporting.humidity(endpoint);
            const payloadBattery = [{
                attribute: 'batteryPercentageRemaining', minimumReportInterval: 1, maximumReportInterval: 120, reportableChange: 1}];
            await endpoint.configureReporting('genPowerCfg', payloadBattery);
            const payload = [{
                attribute: 'measuredValue', minimumReportInterval: 5, maximumReportInterval: repInterval.HOUR, reportableChange: 200}];
            await endpoint.configureReporting('msIlluminanceMeasurement', payload);
            const payloadPressure = [{
                // 0 = measuredValue, override dataType from int16 to uint16
                // https://github.com/Koenkk/zigbee-herdsman/pull/191/files?file-filters%5B%5D=.ts#r456569398
                attribute: {ID: 0, type: 33}, minimumReportInterval: 2, maximumReportInterval: repInterval.HOUR, reportableChange: 3}];
            await endpoint.configureReporting('msPressureMeasurement', payloadPressure);
            const options = {disableDefaultResponse: true};
            await endpoint.write('genBinaryInput', {0x0051: {value: 0x01, type: 0x10}}, options);
            await endpoint.write('genBinaryInput', {0x0101: {value: 25, type: 0x23}}, options);
            const payloadBinaryInput = [{
                attribute: 'presentValue', minimumReportInterval: 0, maximumReportInterval: 30, reportableChange: 1}];
            await endpoint.configureReporting('genBinaryInput', payloadBinaryInput);
            await endpoint.write('genBinaryOutput', {0x0051: {value: 0x01, type: 0x10}}, options);
            const payloadBinaryOutput = [{
                attribute: 'presentValue', minimumReportInterval: 0, maximumReportInterval: 30, reportableChange: 1}];
            await endpoint.configureReporting('genBinaryOutput', payloadBinaryOutput);
        },
    },

    // Enbrighten
    {
        zigbeeModel: ['43076'],
        model: '43076',
        vendor: 'Enbrighten',
        description: 'Zigbee in-wall smart switch',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['43080'],
        model: '43080',
        vendor: 'Enbrighten',
        description: 'Zigbee in-wall smart dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['43102'],
        model: '43102',
        vendor: 'Enbrighten',
        description: 'Zigbee in-wall outlet',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['43100'],
        model: '43100',
        vendor: 'Enbrighten',
        description: 'Plug-in Zigbee outdoor smart switch',
        extend: preset.switch(),
        fromZigbee: [fz.command_on_state, fz.command_off_state],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint1 = device.getEndpoint(1);
            const endpoint2 = device.getEndpoint(2);
            await reporting.bind(endpoint2, coordinatorEndpoint, ['genOnOff']);
            await reporting.bind(endpoint1, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint1);
        },
    },
    {
        zigbeeModel: ['43082'],
        model: '43082',
        vendor: 'Enbrighten',
        description: 'Zigbee in-wall smart dimmer',
        extend: preset.light_onoff_brightness({disableEffect: true}),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['43084'],
        model: '43084',
        vendor: 'Enbrighten',
        description: 'Zigbee in-wall smart switch',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['43090'],
        model: '43090',
        vendor: 'Enbrighten',
        description: 'Zigbee in-wall smart dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },

    // Niko
    {
        zigbeeModel: ['Connected socket outlet'],
        model: '170-33505',
        vendor: 'Niko',
        description: 'Connected socket outlet',
        fromZigbee: [fz.on_off, fz.electrical_measurement],
        toZigbee: [tz.on_off, tz.electrical_measurement_power],
        meta: {configureKey: 5},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement']);
            await reporting.readEletricalMeasurementMultiplierDivisors(endpoint);
            await reporting.activePower(endpoint);
            await reporting.rmsCurrent(endpoint);
            await reporting.rmsVoltage(endpoint);
        },
        exposes: [e.switch(), e.power().withAccess(ea.STATE_GET), e.current(), e.voltage()],
    },
    {
        zigbeeModel: ['Smart plug Zigbee PE'],
        model: '552-80699',
        vendor: 'Niko',
        description: 'Smart plug with earthing pin',
        fromZigbee: [fz.on_off, fz.electrical_measurement, fz.metering, fz.power_on_behavior],
        toZigbee: [tz.on_off, tz.power_on_behavior, tz.electrical_measurement_power],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement', 'seMetering']);
            await reporting.onOff(endpoint);
            // only activePower seems to be support, although compliance document states otherwise
            await endpoint.read('haElectricalMeasurement', ['acPowerMultiplier', 'acPowerDivisor']);
            await reporting.activePower(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.currentSummDelivered(endpoint, {min: 60, change: 1});
        },
        exposes: [
            e.switch(), e.power().withAccess(ea.STATE_GET), e.energy(),
            exposes.enum('power_on_behavior', ea.ALL, ['off', 'previous', 'on'])
                .withDescription('Controls the behaviour when the device is powered on'),
        ],
    },

    // QMotion
    {
        zigbeeModel: ['Rollershade QdR'],
        model: 'QZR-ZIG2400',
        vendor: 'Qmotion',
        description: '5 channel remote',
        fromZigbee: [fz.identify, fz.cover_position_tilt],
        exposes: [e.action(['identify']), exposes.numeric('position', ea.STATE)],
        toZigbee: [],
    },
    {
        zigbeeModel: ['Honeycomb Internal Battery', 'Rollershade Internal Battery'],
        model: 'HDM40PV620',
        vendor: 'Qmotion',
        description: 'Motorized roller blind',
        fromZigbee: [fz.identify],
        toZigbee: [tz.cover_state, tz.cover_position_tilt],
        exposes: [e.cover_position()],
    },

    // Titan Products
    {
        zigbeeModel: ['TPZRCO2HT-Z3'],
        model: 'TPZRCO2HT-Z3',
        vendor: 'Titan Products',
        description: 'Room CO2, humidity & temperature sensor',
        fromZigbee: [fz.battery, fz.humidity, fz.temperature, fz.co2],
        exposes: [e.battery(), e.humidity(), e.temperature(), e.co2()],
        toZigbee: [],
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genPowerCfg', 'msTemperatureMeasurement', 'msCO2']);
            await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['msRelativeHumidity']);
        },
    },

    // Envilar
    {
        zigbeeModel: ['ZG102-BOX-UNIDIM'],
        model: 'ZG102-BOX-UNIDIM',
        vendor: 'Envilar',
        description: 'ZigBee AC phase-cut dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },

    // OWON
    {
        zigbeeModel: ['WSP404'],
        model: 'WSP404',
        vendor: 'OWON',
        description: 'Smart plug',
        fromZigbee: [fz.on_off, fz.metering],
        toZigbee: [tz.on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'seMetering']);
            await reporting.onOff(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.instantaneousDemand(endpoint, {min: 5, max: repInterval.MINUTES_5, change: 2});
        },
        exposes: [e.switch(), e.power(), e.energy()],
    },

    // LeTV
    {
        zigbeeModel: ['qlwz.letv8key.10'],
        model: 'LeTV.8KEY',
        vendor: 'LeTV',
        description: '8key switch',
        fromZigbee: [fz.qlwz_letv8key_switch],
        exposes: [e.action(['hold_up', 'single_up', 'double_up', 'tripple_up', 'hold_down', 'single_down', 'double_down', 'tripple_down',
            'hold_left', 'single_left', 'double_left', 'tripple_left', 'hold_right', 'single_right', 'double_right', 'tripple_right',
            'hold_center', 'single_center', 'double_center', 'tripple_center', 'hold_back', 'single_back', 'double_back', 'tripple_back',
            'hold_play', 'single_play', 'double_play', 'tripple_play', 'hold_voice', 'single_voice', 'double_voice', 'tripple_voice'])],
        toZigbee: [],
    },

    // CY-LIGHTING
    {
        zigbeeModel: ['DM A60F'],
        model: 'DM A60F',
        vendor: 'CY-LIGHTING',
        description: '6W smart dimmable E27 lamp 2700K',
        extend: preset.light_onoff_brightness(),
    },

    // LED Trading
    {
        zigbeeModel: ['HK-LN-DIM-A'],
        model: 'HK-LN-DIM-A',
        vendor: 'LED Trading',
        description: 'ZigBee AC phase-cut dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },

    // FireAngel
    {
        zigbeeModel: ['Alarm_SD_Device'],
        model: 'W2-Module',
        description: 'Carbon monoxide sensor',
        vendor: 'FireAngel',
        fromZigbee: [fz.W2_module_carbon_monoxide, fz.battery],
        toZigbee: [],
        exposes: [e.carbon_monoxide(), e.battery()],
    },

    // KlikAanKlikUit
    {
        zigbeeModel: ['Socket Switch'],
        model: 'ZCC-3500',
        vendor: 'KlikAanKlikUit',
        description: 'Zigbee socket switch',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // Hommyn
    {
        zigbeeModel: ['5e56b9c85b6e4fcaaaad3c1319e16c57'],
        model: 'MS-20-Z',
        vendor: 'Hommyn',
        description: 'Occupancy sensor',
        fromZigbee: [fz.battery, fz.ias_occupancy_alarm_1_with_timeout],
        toZigbee: [],
        exposes: [e.battery(), e.occupancy(), e.battery_low(), e.tamper()],
    },
    {
        zigbeeModel: ['2f077707a13f4120846e0775df7e2efe'],
        model: 'WS-20-Z',
        vendor: 'Hommyn',
        description: 'Water leakage sensor',
        fromZigbee: [fz.ias_water_leak_alarm_1],
        toZigbee: [],
        exposes: [e.water_leak(), e.battery_low(), e.tamper()],
    },

    // Lidl
    ...require('./devices/lidl'),

    // Atsmart
    {
        zigbeeModel: ['Z601', 'Z602', 'Z603', 'Z604'],
        model: 'Z6',
        vendor: 'Atsmart',
        description: '3 gang smart wall switch (no neutral wire)',
        extend: preset.switch(),
        exposes: [e.switch().withEndpoint('left'), e.switch().withEndpoint('center'), e.switch().withEndpoint('right')],
        endpoint: (device) => {
            return {'left': 1, 'center': 2, 'right': 3};
        },
        meta: {configureKey: 1, multiEndpoint: true},
        configure: async (device, coordinatorEndpoint, logger) => {
            try {
                await reporting.bind(device.getEndpoint(1), coordinatorEndpoint, ['genOnOff']);
                await reporting.bind(device.getEndpoint(2), coordinatorEndpoint, ['genOnOff']);
                await reporting.bind(device.getEndpoint(3), coordinatorEndpoint, ['genOnOff']);
            } catch (error) {
                // dip switch for 1-3 gang
            }
        },
    },

    // ADEO
    {
        zigbeeModel: ['LXEK-5'],
        model: 'HR-C99C-Z-C045',
        vendor: 'ADEO',
        description: 'RGB CTT LEXMAN ENKI remote control',
        fromZigbee: [fz.battery, fz.command_on, fz.command_off, fz.command_step, fz.command_stop, fz.command_step_color_temperature,
            fz.command_step_hue, fz.command_step_saturation, fz.color_stop_raw, fz.scenes_recall_scene_65024, fz.ignore_genOta],
        toZigbee: [],
        exposes: [e.battery(), e.action(['on', 'off', 'scene_1', 'scene_2', 'scene_3', 'scene_4', 'color_saturation_step_up',
            'color_saturation_step_down', 'color_stop', 'color_hue_step_up', 'color_hue_step_down',
            'color_temperature_step_up', 'color_temperature_step_down', 'brightness_step_up', 'brightness_step_down', 'brightness_stop'])],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            const binds = ['genBasic', 'genOnOff', 'genPowerCfg', 'lightingColorCtrl', 'genLevelCtrl'];
            await reporting.bind(endpoint, coordinatorEndpoint, binds);
            await reporting.batteryPercentageRemaining(endpoint);
        },
    },
    {
        zigbeeModel: ['LXEK-1'],
        model: '9CZA-A806ST-Q1A',
        vendor: 'ADEO',
        description: 'ENKI LEXMAN E27 LED RGBW',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['LXEK-4'],
        model: '9CZA-M350ST-Q1A',
        vendor: 'ADEO',
        description: 'ENKI LEXMAN GU-10 LED RGBW',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['LXEK-2'],
        model: '9CZA-G1521-Q1A',
        vendor: 'ADEO',
        description: 'ENKI Lexman E27 14W to 100W LED RGBW',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },

    // LightSolutions
    {
        zigbeeModel: ['91-947'],
        model: '200403V2-B',
        vendor: 'LightSolutions',
        description: 'Mini dimmer 200W',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['91-948'],
        model: '200106V3',
        vendor: 'LightSolutions',
        description: 'Zigbee switch 200W',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },

    // BYUN
    {
        zigbeeModel: ['Windows switch  '],
        model: 'M415-6C',
        vendor: 'BYUN',
        description: 'Smoke sensor',
        fromZigbee: [fz.byun_smoke_true, fz.byun_smoke_false],
        toZigbee: [],
        exposes: [e.smoke()],
    },
    {
        zigbeeModel: ['GAS  SENSOR     '],
        model: 'M415-5C',
        vendor: 'BYUN',
        description: 'Gas sensor',
        fromZigbee: [fz.byun_gas_true, fz.byun_gas_false],
        toZigbee: [],
        exposes: [e.gas()],
    },

    // Datek
    {
        zigbeeModel: ['PoP'],
        model: 'HLU2909K',
        vendor: 'Datek',
        description: 'APEX smart plug 16A',
        fromZigbee: [fz.on_off, fz.electrical_measurement, fz.metering, fz.temperature],
        toZigbee: [tz.on_off],
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'haElectricalMeasurement', 'msTemperatureMeasurement']);
            await endpoint.read('haElectricalMeasurement', ['acVoltageMultiplier', 'acVoltageDivisor']);
            await endpoint.read('haElectricalMeasurement', ['acCurrentMultiplier', 'acCurrentDivisor']);
            await endpoint.read('haElectricalMeasurement', ['acPowerMultiplier', 'acPowerDivisor']);
            await reporting.onOff(endpoint);
            await reporting.rmsVoltage(endpoint);
            await reporting.rmsCurrent(endpoint);
            await reporting.activePower(endpoint);
            await reporting.temperature(endpoint);
        },
        exposes: [e.power(), e.current(), e.voltage(), e.switch(), e.temperature()],
    },

    {
        zigbeeModel: ['Meter Reader'],
        model: 'HSE2905E',
        vendor: 'Datek',
        description: 'Datek Eva AMS HAN power-meter sensor',
        fromZigbee: [fz.metering, fz.electrical_measurement, fz.temperature],
        toZigbee: [],
        ota: ota.zigbeeOTA,
        meta: {configureKey: 3},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['haElectricalMeasurement', 'seMetering', 'msTemperatureMeasurement']);
            await reporting.readEletricalMeasurementMultiplierDivisors(endpoint);
            await reporting.rmsVoltage(endpoint);
            await reporting.rmsCurrent(endpoint);
            await reporting.readMeteringMultiplierDivisor(endpoint);
            await reporting.instantaneousDemand(endpoint);
            await reporting.currentSummDelivered(endpoint);
            await reporting.currentSummReceived(endpoint);
            await reporting.temperature(endpoint);
        },
        exposes: [e.power(), e.energy(), e.current(), e.voltage(), e.current_phase_b(), e.voltage_phase_b(), e.current_phase_c(),
            e.voltage_phase_c(), e.temperature()],
    },

    // Prolight
    {
        zigbeeModel: ['PROLIGHT E27 WHITE AND COLOUR'],
        model: '5412748727388',
        vendor: 'Prolight',
        description: 'E27 white and colour bulb',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['PROLIGHT E27 WARM WHITE CLEAR'],
        model: '5412748727432',
        vendor: 'Prolight',
        description: 'E27 filament bulb dimmable',
        extend: preset.light_onoff_brightness(),
    },

    // Fantem
    {
        fingerprint: [{modelID: 'TS0202', manufacturerName: '_TZ3210_rxqls8v0'}, {modelID: 'TS0202', manufacturerName: '_TZ3210_zmy9hjay'}],
        model: 'ZB003-X',
        vendor: 'Fantem',
        description: '4 in 1 multi sensor',
        fromZigbee: [fz.battery, fz.ignore_basic_report, fz.illuminance, fz.ZB003X, fz.ZB003X_attr, fz.ZB003X_occupancy],
        toZigbee: [tz.ZB003X],
        exposes: [e.occupancy(), e.tamper(), e.battery(), e.illuminance(), e.illuminance_lux().withUnit('lx'), e.temperature(),
            e.humidity(), exposes.numeric('reporting_time', ea.STATE_SET).withDescription('Reporting interval in minutes'),
            exposes.numeric('temperature_calibration', ea.STATE_SET).withDescription('Temperature calibration'),
            exposes.numeric('humidity_calibration', ea.STATE_SET).withDescription('Humidity calibration'),
            exposes.numeric('illuminance_calibration', ea.STATE_SET).withDescription('Illuminance calibration'),
            exposes.binary('pir_enable', ea.STATE_SET, true, false).withDescription('Enable PIR sensor'),
            exposes.binary('led_enable', ea.STATE_SET, true, false).withDescription('Enabled LED'),
            exposes.binary('reporting_enable', ea.STATE_SET, true, false).withDescription('Enabled reporting'),
            exposes.enum('sensitivity', ea.STATE_SET, ['low', 'medium', 'high']).withDescription('PIR sensor sensitivity'),
            // eslint-disable-next-line
            exposes.enum('keep_time', ea.STATE_SET, ['0', '30', '60', '120', '240']).withDescription('PIR keep time in seconds')],
    },

    // Eaton/Halo LED
    {
        zigbeeModel: ['Halo_RL5601'],
        model: 'RL460WHZHA69', // The 4" CAN variant presents as 5/6" zigbeeModel.
        vendor: 'Eaton/Halo LED',
        description: 'Wireless Controlled LED retrofit downlight',
        extend: preset.light_onoff_brightness_colortemp({colorTempRange: [200, 370]}),
    },

    // Matcall BV
    {
        zigbeeModel: ['ZG 401224'],
        model: 'ZG401224',
        vendor: 'Matcall',
        description: 'LED dimmer driver',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['ZG 430700', 'ZG  430700'],
        model: 'ZG430700',
        vendor: 'Matcall',
        description: 'LED dimmer driver',
        extend: preset.light_onoff_brightness(),
    },

    // Aldi
    {
        fingerprint: [{modelID: 'TS0505B', manufacturerName: '_TZ3000_j0gtlepx'}],
        model: 'L122FF63H11A5.0W',
        vendor: 'Aldi',
        description: 'LIGHTWAY smart home LED-lamp - spot',
        extend: preset.light_onoff_brightness_colortemp_color({disableColorTempStartup: true}),
        meta: {applyRedFix: true},
    },
    {
        fingerprint: [{modelID: 'TS0505B', manufacturerName: '_TZ3000_kohbva1f'}],
        model: 'L122CB63H11A9.0W',
        vendor: 'Aldi',
        description: 'LIGHTWAY smart home LED-lamp - bulb',
        extend: preset.light_onoff_brightness_colortemp_color({disableColorTempStartup: true}),
        meta: {applyRedFix: true},
    },
    {
        fingerprint: [{modelID: 'TS0505B', manufacturerName: '_TZ3000_iivsrikg'}],
        model: 'L122AA63H11A6.5W',
        vendor: 'Aldi',
        description: 'LIGHTWAY smart home LED-lamp - candle',
        extend: preset.light_onoff_brightness_colortemp_color({disableColorTempStartup: true}),
        meta: {applyRedFix: true},
    },
    {
        fingerprint: [{modelID: 'TS0502B', manufacturerName: '_TZ3000_g1glzzfk'}],
        model: 'F122SB62H22A4.5W',
        vendor: 'Aldi',
        description: 'LIGHTWAY smart home LED-lamp - filament',
        extend: preset.light_onoff_brightness_colortemp({disableColorTempStartup: true}),
    },
    {
        fingerprint: [{modelID: 'TS0505B', manufacturerName: '_TZ3000_v1srfw9x'}],
        model: 'C422AC11D41H140.0W',
        vendor: 'Aldi',
        description: 'MEGOS LED panel RGB+CCT 40W 3600lm 62 x 62 cm',
        extend: preset.light_onoff_brightness_colortemp_color({disableColorTempStartup: true}),
        meta: {applyRedFix: true},
    },
    {
        fingerprint: [{modelID: 'TS0505B', manufacturerName: '_TZ3000_gb5gaeca'}],
        model: 'C422AC14D41H140.0W',
        vendor: 'Aldi',
        description: 'MEGOS LED panel RGB+CCT 40W 3600lm 30 x 120 cm',
        extend: preset.light_onoff_brightness_colortemp_color({disableColorTempStartup: true}),
        meta: {applyRedFix: true},
    },
    {
        fingerprint: [{modelID: 'TS1001', manufacturerName: '_TZ3000_ztrfrcsu'}],
        model: '141L100RC',
        vendor: 'Aldi',
        description: 'MEGOS switch and dimming light remote control',
        exposes: [e.action(['on', 'off', 'brightness_stop', 'brightness_step_up', 'brightness_step_down', 'brightness_move_up',
            'brightness_move_down'])],
        fromZigbee: [fz.command_on, fz.command_off, fz.command_step, fz.command_move, fz.command_stop],
        toZigbee: [],
    },

    // SOHAN Electric
    {
        fingerprint: [{modelID: 'TS0001', manufacturerName: '_TZ3000_bezfthwc'}],
        model: 'RDCBC/Z',
        vendor: 'SOHAN Electric',
        description: 'DIN circuit breaker (1 pole / 2 poles)',
        extend: preset.switch(),
        fromZigbee: [fz.on_off, fz.ignore_basic_report, fz.ignore_time_read],
    },

    // WETEN
    {
        fingerprint: [{modelID: 'TS0001', manufacturerName: '_TZ3000_wrhhi5h2'}],
        model: '1GNNTS',
        vendor: 'WETEN',
        description: '1 gang no neutral touch wall switch',
        extend: preset.switch(),
        fromZigbee: [fz.on_off, fz.ignore_basic_report, fz.ignore_time_read],
    },
];

module.exports = devices.map((device) => {
    const {extend, ...deviceWithoutExtend} = device;

    if (extend) {
        if (extend.hasOwnProperty('configure') && device.hasOwnProperty('configure')) {
            assert.fail(`'${device.model}' has configure in extend and device, this is not allowed`);
        }

        device = {
            ...extend,
            ...deviceWithoutExtend,
            meta: extend.meta || deviceWithoutExtend.meta ? {
                ...extend.meta,
                ...deviceWithoutExtend.meta,
            } : undefined,
        };
    }

    if (device.toZigbee.length > 0) {
        device.toZigbee.push(tz.scene_store, tz.scene_recall, tz.scene_add, tz.scene_remove, tz.scene_remove_all, tz.read, tz.write);
    }

    if (device.exposes) {
        device.exposes = device.exposes.concat([e.linkquality()]);
    }

    return device;
});
