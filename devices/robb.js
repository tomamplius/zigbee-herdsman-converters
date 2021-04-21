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
    // ROBB
    {
        zigbeeModel: ['ROB_200-004-0'],
        model: 'ROB_200-004-0',
        vendor: 'ROBB',
        description: 'ZigBee AC phase-cut dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ROB_200-011-0'],
        model: 'ROB_200-011-0',
        vendor: 'ROBB',
        description: 'ZigBee AC phase-cut dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 2},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ROB_200-003-0'],
        model: 'ROB_200-003-0',
        vendor: 'ROBB',
        description: 'Zigbee AC in wall switch',
        extend: preset.switch(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1) || device.getEndpoint(3);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ROB_200-014-0'],
        model: 'ROB_200-014-0',
        vendor: 'ROBB',
        description: 'ZigBee AC phase-cut rotary dimmer',
        extend: preset.light_onoff_brightness(),
        meta: {configureKey: 1},
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['genOnOff', 'genLevelCtrl']);
            await reporting.onOff(endpoint);
        },
    },
    {
        zigbeeModel: ['ZG2833K8_EU05', 'ROB_200-007-0'],
        model: 'ROB_200-007-0',
        vendor: 'ROBB',
        description: 'Zigbee 8 button wall switch',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery, fz.ignore_genOta],
        exposes: [e.battery(), e.action([
            'on_1', 'off_1', 'brightness_move_up_1', 'brightness_move_down_1', 'brightness_stop_1',
            'on_2', 'off_2', 'brightness_move_up_2', 'brightness_move_down_2', 'brightness_stop_2',
            'on_3', 'off_3', 'brightness_move_up_3', 'brightness_move_down_3', 'brightness_stop_3',
            'on_4', 'off_4', 'brightness_move_up_4', 'brightness_move_down_4', 'brightness_stop_4'])],
        toZigbee: [],
        meta: {multiEndpoint: true, battery: {dontDividePercentage: true}},
        whiteLabel: [{vendor: 'Sunricher', model: 'SR-ZG9001K8-DIM'}],
    },
    {
        zigbeeModel: ['ZG2833K4_EU06', 'ROB_200-008'],
        model: 'ROB_200-008-0',
        vendor: 'ROBB',
        description: 'Zigbee 4 button wall switch',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move, fz.command_stop, fz.battery],
        exposes: [e.battery(), e.action([
            'on_1', 'off_1', 'stop_1', 'brightness_move_up_1', 'brightness_move_down_1', 'brightness_stop_1',
            'on_2', 'off_2', 'stop_2', 'brightness_move_up_2', 'brightness_move_down_2', 'brightness_stop_2'])],
        toZigbee: [],
        meta: {multiEndpoint: true, battery: {dontDividePercentage: true}},
        whiteLabel: [{vendor: 'Sunricher', model: 'SR-ZG9001K4-DIM2'}],
    },
    {
        zigbeeModel: ['Motor Controller', 'ROB_200-010-0'],
        model: 'ROB_200-010-0',
        vendor: 'ROBB',
        description: 'Zigbee curtain motor controller',
        meta: {configureKey: 2, coverInverted: true},
        fromZigbee: [fz.cover_position_tilt],
        toZigbee: [tz.cover_state, tz.cover_position_tilt],
        configure: async (device, coordinatorEndpoint, logger) => {
            const endpoint = device.getEndpoint(1);
            await reporting.bind(endpoint, coordinatorEndpoint, ['closuresWindowCovering']);
            await reporting.currentPositionLiftPercentage(endpoint);
        },
        exposes: [e.cover_position()],
    },
    {
        zigbeeModel: ['ROB_200-018-0'],
        model: 'ROB_200-018-0',
        vendor: 'ROBB',
        description: 'ZigBee knob smart dimmer',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_move_to_level, fz.command_move_to_color_temp],
        exposes: [e.action(['on', 'off', 'brightness_move_to_level', 'color_temperature_move'])],
        toZigbee: [],
        whiteLabel: [{vendor: 'Sunricher', model: 'SR-ZG2835'}],
    },

]