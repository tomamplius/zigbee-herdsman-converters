const fz = {...require('../converters/fromZigbee'), legacy: require('../lib/legacy').fromZigbee};
const tz = require('../converters/toZigbee');
const globalStore = require('../lib/store');
const ota = require('../lib/ota');
const exposes = require('../lib/exposes');
const tuya = require('../lib/tuya');
const ikea = require('../lib/ikea');
const constants = require('../lib/constants');
const livolo = require('../lib/livolo');
const legrand = require('../lib/legrand');
const xiaomi = require('../lib/xiaomi');
const {repInterval, defaultBindGroup, OneJanuary2000} = require('../lib/constants');
const reporting = require('../lib/reporting');
const preset = require('../lib/presets');

const e = exposes.presets;
const ea = exposes.access;

module.exports = [
    // iCasa
    {
        zigbeeModel: ['ICZB-IW11D'],
        model: 'ICZB-IW11D',
        vendor: 'iCasa',
        description: 'ZigBee AC dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ICZB-DC11'],
        model: 'ICZB-DC11',
        vendor: 'iCasa',
        description: 'ZigBee 12-36V DC LED dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ICZB-IW11SW'],
        model: 'ICZB-IW11SW',
        vendor: 'iCasa',
        description: 'Zigbee 3.0 AC switch',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1) || device.getEndpoint(3);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ICZB-KPD12'],
        model: 'ICZB-KPD12',
        vendor: 'iCasa',
        description: 'Zigbee 3.0 Keypad Pulse 2',
        meta: {battery: {dontDividePercentage: true}},
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['on', 'off', 'brightness_move_up', 'brightenss_move_down', 'brightness_stop'])],
        toZigbee: [],
        whiteLabel: [{vendor: 'Sunricher', model: 'SR-ZG9001K2-DIM'}],
    },
    {
        zigbeeModel: ['ICZB-KPD14S'],
        model: 'ICZB-KPD14S',
        vendor: 'iCasa',
        description: 'Zigbee 3.0 Keypad Pulse 4S',
        meta: {battery: {dontDividePercentage: true}},
        fromZigbee: [fz.command_recall, fz.legacy.scenes_recall_click, fz.command_on, fz.legacy.genOnOff_cmdOn, fz.command_off,
            fz.legacy.genOnOff_cmdOff, fz.battery, fz.legacy.cmd_move_with_onoff, fz.legacy.cmd_stop_with_onoff],
        exposes: [e.battery(), e.action(['recall_*', 'on', 'off', 'brightness_move_up', 'brightenss_move_down', 'brightness_stop'])],
        toZigbee: [],
    },
    {
        zigbeeModel: ['ICZB-KPD18S'],
        model: 'ICZB-KPD18S',
        vendor: 'iCasa',
        description: 'Zigbee 3.0 Keypad Pulse 8S',
        meta: {battery: {dontDividePercentage: true}},
        fromZigbee: [fz.command_recall, fz.legacy.scenes_recall_click, fz.command_on, fz.legacy.genOnOff_cmdOn, fz.command_off,
            fz.legacy.genOnOff_cmdOff, fz.battery, fz.legacy.cmd_move_with_onoff, fz.legacy.cmd_stop_with_onoff],
        exposes: [e.battery(), e.action(['on', 'recall_*', 'off', 'brightness_stop', 'brightness_move_up', 'brightness_move_down'])],
        toZigbee: [],
    },
    {
        zigbeeModel: ['ICZB-RM11S'],
        model: 'ICZB-RM11S',
        vendor: 'iCasa',
        description: 'Zigbee 3.0 remote control',
        fromZigbee: [fz.command_recall, fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action(['recall_*', 'on', 'off', 'brightness_stop', 'brightness_move_up', 'brightness_move_down'])],
        toZigbee: [],
    },
    {
        zigbeeModel: ['ICZB-FC'],
        model: 'ICZB-B1FC60/B3FC64/B2FC95/B2FC125',
        vendor: 'iCasa',
        description: 'Zigbee 3.0 Filament Lamp 60/64/95/125 mm, 806 lumen, dimmable, clear',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['ICZB-R11D'],
        model: 'ICZB-R11D',
        vendor: 'iCasa',
        description: 'Zigbee AC dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ICZB-R12D'],
        model: 'ICZB-R12D',
        vendor: 'iCasa',
        description: 'Zigbee AC dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },

]