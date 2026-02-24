function toRows(takeoffs) {
  return takeoffs.map((item) => ({
    'Item Name': item.label,
    Type: item.type,
    Page: item.page + 1,
    'Measurement Value': Number(item.value.toFixed(3)),
    Units: item.units
  }));
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCsv(takeoffs, fileName = 'takeoff.csv') {
  const rows = toRows(takeoffs);
  const headers = Object.keys(rows[0] || {
    'Item Name': '',
    Type: '',
    Page: '',
    'Measurement Value': '',
    Units: ''
  });
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((key) => JSON.stringify(row[key] ?? '')).join(','));
  }
  downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), fileName);
}

export async function exportXlsx(takeoffs, fileName = 'takeoff.xlsx') {
  const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
  const rows = toRows(takeoffs);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Takeoffs');
  const wbArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  downloadBlob(new Blob([wbArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
}
