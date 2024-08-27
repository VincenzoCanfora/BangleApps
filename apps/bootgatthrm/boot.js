(() => {
  function setupBLEAdvertising() {
    /*
     * Questa funzione prepara l'advertisement BLE per i sensori.
     */
    require("ble_advert").set(0x180d, undefined, {
      connectable: true,
      discoverable: true,
      scannable: true,
      whenConnected: true,
    });

    NRF.setServices({
      0x180D: { // heart_rate
        0x2A37: { // heart_rate_measurement
          notify: true,
          value: [0x06, 0],
        },
        0x2A38: { // Sensor Location: Wrist
          value: 0x02,
        }
      },
      0x181A: { // environmental_sensing
        0x2A6C: { // elevation
          notify: true,
          value: [0, 0, 0],
        },
        0x2A6D: { // pressure
          notify: true,
          value: [0, 0, 0, 0],
        },
        0x2A1F: { // temperature
          notify: true,
          value: [0, 0],
        },
        0x2AA1: { // magnetic flux density
          notify: true,
          value: [0, 0, 0, 0, 0, 0],
        }
      },
      0x1819: { // location_and_navigation
        0x2A67: { // position quality
          notify: true,
          value: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        }
      }
    });
  }

  function updateBLEData(hrm, bar, mag, gps) {
    /*
     * Invia i dati aggiornati dei sensori via BLE
     */
    const services = {
      0x180D: {
        0x2A37: {
          value: hrm && hrm.confidence >= 50 ? [0x06, hrm.bpm] : [0x06, 0],
          notify: true
        },
        0x2A38: {
          value: 0x02,
        }
      },
      0x181A: {
        0x2A6C: {
          value: bar ? toByteArray(Math.round(bar.altitude * 100), 3, true) : [0, 0, 0],
          notify: true
        },
        0x2A6D: {
          value: bar ? toByteArray(Math.round(bar.pressure * 10), 4, false) : [0, 0, 0, 0],
          notify: true
        },
        0x2A1F: {
          value: bar ? toByteArray(Math.round(bar.temperature * 10), 2, true) : [0, 0],
          notify: true
        },
        0x2AA1: {
          value: mag ? encodeMag(mag) : [0, 0, 0, 0, 0, 0],
          notify: true
        }
      },
      0x1819: {
        0x2A67: {
          value: gps ? encodeGps(gps) : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          notify: true
        }
      }
    };

    try {
      NRF.updateServices(services);
    } catch (error) {
      if (error.message.includes("BLE restart")) {
        NRF.disconnect();
      } else if (error.message.includes("UUID")) {
        setupBLEAdvertising();
      } else {
        console.log("[BLE]: Unexpected error updating BLE data! Error: " + error.message);
      }
    }
  }

  function toByteArray(value, numberOfBytes, isSigned) {
    let byteArray = new Array(numberOfBytes);
    if (isSigned && (value < 0)) value += 1 << (numberOfBytes * 8);
    for (let index = 0; index < numberOfBytes; index++) {
      byteArray[index] = (value >> (index * 8)) & 0xff;
    }
    return byteArray;
  }

  function encodeGps(data) {
    const speed = toByteArray(Math.round(1000 * data.speed / 36), 2, false);
    const lat = toByteArray(Math.round(data.lat * 10000000), 4, true);
    const lon = toByteArray(Math.round(data.lon * 10000000), 4, true);
    const elevation = toByteArray(Math.round(data.alt * 100), 3, true);
    const heading = toByteArray(Math.round(data.course * 100), 2, false);
    return [
      157, 2,
      speed[0], speed[1],
      lat[0], lat[1], lat[2], lat[3],
      lon[0], lon[1], lon[2], lon[3],
      elevation[0], elevation[1], elevation[2],
      heading[0], heading[1]
    ];
  }

  function encodeMag(data) {
    const x = toByteArray(data.x, 2, true);
    const y = toByteArray(data.y, 2, true);
    const z = toByteArray(data.z, 2, true);
    return [x[0], x[1], y[0], y[1], z[0], z[1]];
  }

  // Setup iniziale dei servizi BLE
  setupBLEAdvertising();

  // Collegamento dei sensori agli eventi
  let bar, mag, gps;
  Bangle.on("HRM", (hrm) => updateBLEData(hrm, bar, mag, gps));
  Bangle.on("pressure", (newBar) => { bar = newBar; updateBLEData(undefined, bar, mag, gps); });
  Bangle.on("mag", (newMag) => { mag = newMag; updateBLEData(undefined, bar, mag, gps); });
  Bangle.on("GPS", (newGps) => { gps = newGps; updateBLEData(undefined, bar, mag, gps); });
})();
