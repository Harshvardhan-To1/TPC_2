/**
 * PLACEMAT — utils/csvExport.js
 * Convert JSON array to CSV and send as download
 */

function arrayToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows    = data.map(row =>
    headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

function sendCSV(res, data, filename = 'export.csv') {
  const csv = arrayToCSV(data);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { arrayToCSV, sendCSV };
