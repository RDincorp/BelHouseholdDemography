/**
 * Calculates linear regression for a set of data points
 * @param {Array} data - Array of objects { x: numericYear, y: value }
 * @returns {Object} { slope, intercept, predict(x) }
 */
export function calculateLinearRegression(data) {
  if (!data || data.length < 2) return null;

  const n = data.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let i = 0; i < n; i++) {
    const x = data[i].x;
    const y = data[i].y;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  
  // To avoid a visual "jump" in the forecast, we anchor the trend line to the last actual data point.
  // Standard intercept: (sumY - slope * sumX) / n
  // Anchored intercept: lastY - slope * lastX
  const lastX = data[data.length - 1].x;
  const lastY = data[data.length - 1].y;
  const anchoredIntercept = lastY - slope * lastX;

  return {
    slope,
    intercept: anchoredIntercept,
    predict: (x) => slope * x + anchoredIntercept
  };
}

/**
 * Augments existing chart data with forecasted future years
 * @param {Array} chartData - The existing chronological chart data [{ year: '2021', 'Line1': 100 }, ...]
 * @param {Array} lines - Array of active line keys (e.g. ['Минск', 'Брест'])
 * @param {number} yearsAhead - How many years into the future to predict (1-10)
 * @returns {Array} New combined array of data with `isForecast: true` flag on future rows
 */
export function generateForecastData(chartData, lines, yearsAhead = 5) {
  if (!chartData || chartData.length < 2 || yearsAhead <= 0) return chartData;

  const result = [...chartData.map(row => ({ ...row, isForecast: false }))];
  
  // Try to parse the last year
  const lastRow = result[result.length - 1];
  let lastYear = parseInt(lastRow.year, 10);
  if (isNaN(lastYear)) return chartData; // Cannot forecast if years are not numeric

  // Compute regression models for each active line
  const models = {};
  lines.forEach(lineKey => {
    // Extract training data for this specific line
    const trainingData = result
      .map(row => ({ x: parseInt(row.year, 10), y: row[lineKey] }))
      .filter(pt => !isNaN(pt.x) && typeof pt.y === 'number' && !isNaN(pt.y));
    
    if (trainingData.length >= 2) {
      models[lineKey] = calculateLinearRegression(trainingData);
    }
  });

  // Generate future rows
  for (let i = 1; i <= yearsAhead; i++) {
    const futureYear = lastYear + i;
    const futureRow = { year: futureYear.toString(), isForecast: true };
    
    let hasAnyPrediction = false;
    lines.forEach(lineKey => {
      const model = models[lineKey];
      if (model) {
        // Compute predicted value
        let predictedValue = model.predict(futureYear);
        if (predictedValue < 0) predictedValue = 0; 
        
        if (predictedValue >= 1000) {
            predictedValue = Math.round(predictedValue);
        } else if (predictedValue >= 10) {
            predictedValue = Number(predictedValue.toFixed(1));
        } else {
            predictedValue = Number(predictedValue.toFixed(2));
        }

        futureRow[lineKey] = predictedValue;
        hasAnyPrediction = true;
      }
    });

    if (hasAnyPrediction) {
      result.push(futureRow);
    }
  }

  return result;
}
