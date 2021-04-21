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
    // Paulmann
    {
        zigbeeModel: ['H036-0007'],
        model: '929.66',
        vendor: 'Paulmann',
        description: 'Smart home Zigbee LED module coin 1x2.5W RGBW',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['Switch Controller '],
        model: '50043',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee Cephei Switch Controller',
        extend: preset.switch(),
    },
    {
        zigbeeModel: ['Dimmablelight '],
        model: '50044/50045',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee Dimmer or LED-stripe',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['500.47'],
        model: '500.47',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee MaxLED RGBW controller max. 72W 24V DC',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['RGBW light', '500.49'],
        model: '50049/500.63',
        vendor: 'Paulmann',
        description: 'Smart Home Zigbee YourLED RGB Controller max. 60W / Smart Home Zigbee LED Reflektor 3,5W GU10 RGBW dimmbar',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['CCT light'],
        model: '50064',
        vendor: 'Paulmann',
        description: 'SmartHome led spot',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['500.46', 'H036-0006'],
        model: '929.63',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee LED-Modul Coin 1x6W Tunable White',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['H036-0005'],
        model: '929.60',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee LED-Modul Coin 1x6W White',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['371000001'],
        model: '371000001',
        vendor: 'Paulmann',
        description: 'SmartHome led spot tuneable white',
        extend: preset.light_onoff_brightness_colortemp(),
    },
    {
        zigbeeModel: ['371000002'],
        model: '371000002',
        vendor: 'Paulmann',
        description: 'Amaris LED panels',
        extend: preset.light_onoff_brightness_colortemp_color(),
    },
    {
        zigbeeModel: ['500.45'],
        model: '798.15',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee Pendulum Light Aptare',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['500.48'],
        model: '500.48',
        vendor: 'Paulmann',
        description: 'SmartHome Zigbee YourLED dim/switch controller max. 60 W',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['H036-0001'],
        model: '93999',
        vendor: 'Paulmann',
        description: 'Plug Shine Zigbee controller',
        extend: preset.light_onoff_brightness(),
    },
    {
        zigbeeModel: ['RemoteControl '],
        model: '500.67',
        vendor: 'Paulmann',
        description: 'RGB remote control',
        fromZigbee: [fz.command_on, fz.command_off, fz.command_toggle, fz.command_step, fz.command_move_to_color_temp,
            fz.command_move_to_color, fz.command_stop, fz.command_move, fz.command_color_loop_set,
            fz.command_ehanced_move_to_hue_and_saturation, fz.tint_scene],
        toZigbee: [],
        exposes: [e.action([
            'on', 'off', 'toggle', 'brightness_step_up', 'brightness_step_down', 'color_temperature_move', 'color_move', 'brightness_stop',
            'brightness_move_down', 'brightness_move_up', 'color_loop_set', 'enhanced_move_to_hue_and_saturation', 'scene_*'])],
    },

]