// const csvUrl = 'data/clean_data.csv';
const csvUrl = 'https://raw.githubusercontent.com/kv-hearst/cpi-grocery-calculator/main/data/clean_data.csv';


let rows = []; 
let currentTotal = 0;
let previousTotal = 0;
let selectedItems = new Set(); 
let receiptItems = new Map(); 

const categoryMapping = {
    'pantry': 'pantry',
    'produce': 'produce',
    'meat': 'meat',
    'dairy': 'dairy',
    'beverage': 'beverage',
    'snacks': 'snacks'
};

fetch(csvUrl)
    .then(response => response.text())
    .then(data => {
        rows = data.split('\n').filter(row => row.trim()); // Remove empty rows
        console.log('Loaded rows:', rows.length);
        
        if (rows.length < 2) {
            console.error('CSV must have at least a header row and one data row');
            return;
        }
        
        populateGroceryList();
        setupPriceCalculators();
        updateDisplays();
        updateReceiptDisplay();
        updateFootnoteDate();
    })
    .catch(error => console.error('Error fetching the CSV file:', error));

function populateGroceryList() {
    // Clear existing items from all aisles
    clearAllAisles();

    // Skip header row (index 0) and add items to corresponding aisles
    rows.slice(1).forEach((row, index) => {
        const columns = parseCSVRow(row);
        const itemName = columns[1]; // item_name is the second column
        const category = columns[4]; // category is the fifth column (index 4)
        
        if (itemName && itemName.trim()) {
            const cleanItemName = itemName.trim();
            const cleanCategory = category ? category.trim().toLowerCase() : '';
            
            // Determine which aisle this item belongs to
            let aisleId = 'pantry'; // default aisle
            
            if (cleanCategory && categoryMapping[cleanCategory]) {
                aisleId = categoryMapping[cleanCategory];
            }
            
            // Get the aisle container by ID
            const aisleContainer = document.getElementById(aisleId);
            if (aisleContainer) {
                const button = document.createElement('button');
                button.textContent = cleanItemName;
                button.dataset.rowIndex = index; // Store the row index for later use
                button.className = 'item-button grocery-item';
                
                aisleContainer.appendChild(button);
            } else {
                console.error(`Aisle container with ID "${aisleId}" not found.`);
            }
        }
    });
}

function clearAllAisles() {
    const aisleIds = ['produce', 'meat', 'dairy', 'pantry', 'beverage', 'snacks'];
    aisleIds.forEach(aisleId => {
        const aisleContainer = document.getElementById(aisleId);
        if (aisleContainer) {
           
            const header = aisleContainer.querySelector('h3');
            aisleContainer.innerHTML = '';
            if (header) {
                aisleContainer.appendChild(header);
            }
        }
    });
}

function setupPriceCalculators() {
   
    const buttons = document.querySelectorAll('.aisle button');
    
    if (buttons.length === 0) {
        console.warn('No grocery item buttons found');
        return;
    }
    
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const rowIndex = parseInt(button.dataset.rowIndex);
            const itemId = `item_${rowIndex}`; // Unique identifier for each item
            
            // Toggle selection
            button.classList.toggle('selected');
            
            if (button.classList.contains('selected')) {
                // Item was just selected
                if (!selectedItems.has(itemId)) {
                    selectedItems.add(itemId);
                    addItemToTotals(rowIndex + 1, button.textContent); // +1 because we skipped header
                }
            } else {
                // Item was just deselected
                if (selectedItems.has(itemId)) {
                    selectedItems.delete(itemId);
                    removeItemFromTotals(rowIndex + 1, button.textContent); // +1 because we skipped header
                }
            }
            
            updateDisplays();
            updateReceiptDisplay(); // ADDED: Update receipt in real-time
        });
    });
}

function addItemToTotals(rowIndex, itemName) {
    if (rowIndex >= rows.length) {
        console.error('Row index out of bounds:', rowIndex);
        return;
    }
    
    const columns = parseCSVRow(rows[rowIndex]);
    
    // Get current price (last column) - handle empty/invalid values
    const currentPriceRaw = columns[columns.length - 1];
    const currentPrice = isValidPrice(currentPriceRaw) ? parseFloat(currentPriceRaw) : 0;
    currentTotal = roundToTwoDecimals(currentTotal + currentPrice);
    
    // Get previous price - assuming it's 12 columns before the last one
    const previousPriceIndex = Math.max(0, columns.length - 13);
    const previousPriceRaw = columns[previousPriceIndex];
    const previousPrice = isValidPrice(previousPriceRaw) ? parseFloat(previousPriceRaw) : 0;
    previousTotal = roundToTwoDecimals(previousTotal + previousPrice);
    
    // Add to receipt items
    receiptItems.set(itemName, {
        currentPrice: currentPrice,
        previousPrice: previousPrice
    });
    
    console.log(`Added item: Current=${currentPrice}, Previous=${previousPrice}`);
}

function removeItemFromTotals(rowIndex, itemName) {
    if (rowIndex >= rows.length) {
        console.error('Row index out of bounds:', rowIndex);
        return;
    }
    
    const columns = parseCSVRow(rows[rowIndex]);
    
    // Remove current price (last column) - handle empty/invalid values
    const currentPriceRaw = columns[columns.length - 1];
    const currentPrice = isValidPrice(currentPriceRaw) ? parseFloat(currentPriceRaw) : 0;
    currentTotal = roundToTwoDecimals(Math.max(0, currentTotal - currentPrice));
    
    // Remove previous price
    const previousPriceIndex = Math.max(0, columns.length - 13);
    const previousPriceRaw = columns[previousPriceIndex];
    const previousPrice = isValidPrice(previousPriceRaw) ? parseFloat(previousPriceRaw) : 0;
    previousTotal = roundToTwoDecimals(Math.max(0, previousTotal - previousPrice));
    
    // Remove from receipt items
    receiptItems.delete(itemName);
    
    console.log(`Removed item: Current=${currentPrice}, Previous=${previousPrice}`);
}

function updateDisplays() {
    currentTotal = Math.max(0, currentTotal);
    previousTotal = Math.max(0, previousTotal);
    
    // Update current price display
    const priceNowElement = document.getElementById('priceNow');
    if (priceNowElement && rows.length > 0) {
        const currentHeader = getColumnHeader(-1); // Last column
        priceNowElement.textContent = `Total cost in ${currentHeader}: $${formatPrice(currentTotal)}`;
    } else if (!priceNowElement) {
        console.error('Element with ID "priceNow" not found.');
    }
    
    // Update previous price display
    const priceBeforeElement = document.getElementById('priceBefore');
    if (priceBeforeElement && rows.length > 0) {
        const previousHeader = getColumnHeader(-13); // 13th column from the end
        priceBeforeElement.textContent = `Cost last year: $${formatPrice(previousTotal)}`;
    } else if (!priceBeforeElement) {
        console.error('Element with ID "priceBefore" not found.');
    }
}

function updateReceiptDisplay() {
    const receiptItemsContainer = document.getElementById('receiptItems');
    const receiptTotalsContainer = document.getElementById('receiptTotals');
 
    receiptItemsContainer.innerHTML = '';
    receiptTotalsContainer.innerHTML = '';
    
    if (receiptItems.size === 0) {
        receiptItemsContainer.innerHTML = '<div style="text-align: center; color: #666; font-style: italic; padding: 20px;">No items in cart</div>';
    } else {
        // Add header row for better organization
        const headerDiv = document.createElement('div');
        headerDiv.className = 'receipt-item';
        headerDiv.style.fontWeight = 'bold';
        headerDiv.style.borderBottom = '2px solid #333';
        headerDiv.style.marginBottom = '10px';
        headerDiv.innerHTML = `
            <span class="item-name">Item</span>
            <span class="item-price">September 2025</span>
            <span class="item-change">Previous Year</span>
        `;
        receiptItemsContainer.appendChild(headerDiv);
        
        // Add each item to receipt
        receiptItems.forEach((itemData, itemName) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'receipt-item';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'item-name';
            nameSpan.textContent = itemName;
            
            const priceSpan = document.createElement('span');
            priceSpan.className = 'item-price';
            
            const priceDifference = itemData.currentPrice - itemData.previousPrice;
            const isIncrease = priceDifference > 0;
            const isDecrease = priceDifference < 0;

            if (Math.abs(priceDifference) < 0.01) {
                priceSpan.style.color = '#666';
            } else {
                priceSpan.style.color = isIncrease ? '#E1372D' : '#5C8D20'; // Red for increase, green for decrease
            }

            priceSpan.textContent = `$${formatPrice(itemData.currentPrice)}`;

            
            
            // Calculate and display price change
            const changeSpan = document.createElement('span');
            changeSpan.className = 'item-change';
            const pricePrevious = itemData.previousPrice;
            changeSpan.textContent = `$${formatPrice(pricePrevious)}`;
            changeSpan.style.fontWeight = 'normal';
     
            itemDiv.appendChild(nameSpan);
            itemDiv.appendChild(priceSpan);
            itemDiv.appendChild(changeSpan);
            receiptItemsContainer.appendChild(itemDiv);
        });
    }

    if (receiptItems.size > 0) {
        // Add a separator line
        const separatorDiv = document.createElement('div');
        separatorDiv.style.borderTop = '2px solid #333';
        separatorDiv.style.margin = '15px 0 10px 0';
        receiptItemsContainer.appendChild(separatorDiv);
        
        // Create totals row with aligned columns
        const totalsDiv = document.createElement('div');
        totalsDiv.className = 'receipt-item';
        totalsDiv.style.fontWeight = 'bold';
        totalsDiv.style.fontSize = '1.125rem';
        totalsDiv.style.borderBottom = 'none';
        
        const totalLabelSpan = document.createElement('span');
        totalLabelSpan.className = 'item-name';
        totalLabelSpan.textContent = 'Total:';
        
        const currentTotalSpan = document.createElement('span');
        currentTotalSpan.className = 'item-price';
        currentTotalSpan.textContent = `$${formatPrice(currentTotal)}`;
        
        const lastYearTotalSpan = document.createElement('span');
        lastYearTotalSpan.className = 'item-change';
        lastYearTotalSpan.textContent = `$${formatPrice(previousTotal)}`;
        lastYearTotalSpan.style.color = '#333';
        lastYearTotalSpan.style.fontWeight = 'normal';
        
        totalsDiv.appendChild(totalLabelSpan);
        totalsDiv.appendChild(currentTotalSpan);
        totalsDiv.appendChild(lastYearTotalSpan);
        receiptItemsContainer.appendChild(totalsDiv);
        
        // Add difference calculation below
        // const difference = currentTotal - previousTotal;
        // const isIncrease = difference > 0;
        
        // if (Math.abs(difference) > 0.01) {
        //     const differenceDiv = document.createElement('div');
        //     differenceDiv.style.textAlign = 'left';
        //     differenceDiv.style.marginTop = '10px';
        //     differenceDiv.style.fontWeight = 'bold';
        //     differenceDiv.style.fontSize = '1.125rem';
        //     differenceDiv.style.color = isIncrease ? '#E1372D' : '#5C8D20';
        //     differenceDiv.textContent = `Percent change:`;
        //     differenceDiv.style.color = '#333';
            
        //     if (isIncrease && previousTotal > 0) {
        //         const percentageIncrease = ((difference / previousTotal) * 100);
        //         differenceDiv.style.color = isIncrease ? '#E1372D' : '#5C8D20';
        //         differenceDiv.textContent += ` ${formatPrice(percentageIncrease)}% increase`;
                
        //     }
            
        //     receiptItemsContainer.appendChild(differenceDiv);
        // }

        const difference = currentTotal - previousTotal;
        const isIncrease = difference > 0;
        const isDecrease = difference < 0;

        if (Math.abs(difference) > 0.01) {
            const differenceDiv = document.createElement('div');
            differenceDiv.style.textAlign = 'left';
            differenceDiv.style.marginTop = '10px';
            differenceDiv.style.fontWeight = 'bold';
            differenceDiv.style.fontSize = '1.125rem';
            differenceDiv.textContent = `Percent change:`;
            differenceDiv.style.color = '#333';
            
            if (isIncrease && previousTotal > 0) {
                const percentageIncrease = ((difference / previousTotal) * 100);
                differenceDiv.style.color = '#E1372D';
                differenceDiv.textContent += ` ${formatPrice(percentageIncrease)}% increase`;
            } else if (isDecrease && previousTotal > 0) {
                const percentageDecrease = ((Math.abs(difference) / previousTotal) * 100);
                differenceDiv.style.color = '#5C8D20';
                differenceDiv.textContent += ` ${formatPrice(percentageDecrease)}% decrease`;
            }
            
            receiptItemsContainer.appendChild(differenceDiv);
        }
        
    }
}
    

function getColumnHeader(columnIndex) {
    if (rows.length === 0) return 'Unknown';
    
    const headers = parseCSVRow(rows[0]);
    let actualIndex;
    
    if (columnIndex < 0) {
        actualIndex = headers.length + columnIndex; // Convert negative index to positive
    } else {
        actualIndex = columnIndex;
    }
    
    // Ensure index is within bounds
    actualIndex = Math.max(0, Math.min(actualIndex, headers.length - 1));
    
    return headers[actualIndex]?.trim() || 'Unknown';
}

function parseCSVRow(row) {
    const columns = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
        const char = row[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            columns.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    // Don't forget the last column
    columns.push(current);
    
    return columns;
}

// Helper function to check if a price value is valid
function isValidPrice(value) {
    if (!value || value.trim() === '') return false;
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num);
}

// Helper function to round to exactly 2 decimal places and avoid floating point errors
function roundToTwoDecimals(num) {
    // Handle very small numbers that should be zero
    if (Math.abs(num) < 0.005) {
        return 0;
    }
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

// Helper function to format price display - removes ghost decimals
function formatPrice(price) {
    if (price === 0) return '0.00';
    
    const rounded = roundToTwoDecimals(price);
    
    // Convert to string with exactly 2 decimal places
    const formatted = rounded.toFixed(2);
    
    // Remove any ghost decimals (like .00 when it should just be 0.00)
    return formatted;
}

// UPDATED: Reset function now keeps receipt visible and updates it
function resetCalculator() {
    currentTotal = 0;
    previousTotal = 0;
    selectedItems.clear();
    receiptItems.clear(); // Clear receipt items
    
    // Remove selected class from all buttons
    const buttons = document.querySelectorAll('.aisle button');
    buttons.forEach(button => button.classList.remove('selected'));
    
    updateDisplays();
    updateReceiptDisplay(); // ADDED: Update receipt to show empty state
}
function updateFootnoteDate() {
    const latestDate = getColumnHeader(-1); 
    const footnoteElement = document.querySelector('.footnote p');

    if (footnoteElement && latestDate) {
        footnoteElement.innerHTML = `<i>Data as of ${latestDate}. Prices are based on the average cost of grocery items per pound, gallon, or ounce in the U.S. and may vary by location and store. Wine is measured per liter, while eggs are measured by the dozen.</i><br><br>
        Interactive: Katrina Ventura/Get the Facts Data Team • Source: <a href="https://www.bls.gov/bls/api_features.htm" target="_blank">Consumer Price Index via BLS</a>`;
    } else {
        console.error('Footnote element not found or latest date is unavailable.');
    }
}
