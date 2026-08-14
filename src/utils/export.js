import Papa from 'papaparse';

/**
 * Exports data to CSV and triggers download
 * @param {Array} data - Array of row objects
 * @param {Array} columns - Array of column keys to include
 * @param {string} filename - Output filename (without .csv)
 */
export function exportToCSV(data, columns, filename = 'demography_data') {
  if (!data || !data.length || !columns || !columns.length) return;

  // Format data for export
  const exportData = data.map(row => {
    const newRow = {};
    columns.forEach(col => {
      newRow[col] = row[col] !== undefined && row[col] !== null ? row[col] : '';
    });
    return newRow;
  });

  const csv = Papa.unparse(exportData, {
    delimiter: ';', // Semicolon is better for European Excel
  });

  // Create a Blob and download link
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel UTF-8 support
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
