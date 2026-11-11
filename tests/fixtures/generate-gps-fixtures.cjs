// Bir kerelik geliştirme aracı: GPS EXIF'li test fotoğrafları üretir.
// Çalıştırma: node tests/fixtures/_gen-gps-fixtures.cjs
const fs = require('fs');
const path = require('path');
const piexif = require('piexifjs');

const basePath = path.join(__dirname, 'sample-no-gps.jpg');
const baseData = fs.readFileSync(basePath, 'binary');

/**
 * @param {string} outName
 * @param {number} lat
 * @param {number} lng
 * @param {Date} takenAt
 */
function writeGpsFixture(outName, lat, lng, takenAt) {
  const gps = {
    [piexif.GPSIFD.GPSLatitudeRef]: lat >= 0 ? 'N' : 'S',
    [piexif.GPSIFD.GPSLatitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lat)),
    [piexif.GPSIFD.GPSLongitudeRef]: lng >= 0 ? 'E' : 'W',
    [piexif.GPSIFD.GPSLongitude]: piexif.GPSHelper.degToDmsRational(Math.abs(lng)),
  };

  const pad = (n) => String(n).padStart(2, '0');
  const exifDateStr = `${takenAt.getFullYear()}:${pad(takenAt.getMonth() + 1)}:${pad(takenAt.getDate())} ${pad(takenAt.getHours())}:${pad(takenAt.getMinutes())}:${pad(takenAt.getSeconds())}`;

  const exifDict = {
    '0th': {},
    Exif: { [piexif.ExifIFD.DateTimeOriginal]: exifDateStr },
    GPS: gps,
  };

  const exifBytes = piexif.dump(exifDict);
  const newData = piexif.insert(exifBytes, baseData);
  fs.writeFileSync(path.join(__dirname, outName), Buffer.from(newData, 'binary'));
  console.log('yazıldı:', outName);
}

writeGpsFixture('sample-gps-a.jpg', 39.0, 35.0, new Date('2026-01-01T10:00:00'));
writeGpsFixture('sample-gps-b.jpg', 39.00005, 35.00005, new Date('2026-01-01T10:01:00')); // a'ya ~6m, aynı pin
writeGpsFixture('sample-gps-c.jpg', 39.001, 35.001, new Date('2026-01-01T10:02:00')); // a'ya ~120m, ayrı pin
