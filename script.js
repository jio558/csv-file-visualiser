document.addEventListener('DOMContentLoaded', () => {
    const csvFile = document.getElementById('csvFile');
    const importBtn = document.getElementById('importBtn');
    const page1 = document.getElementById('page1');
    const page2 = document.getElementById('page2');
    const canvas = document.getElementById('myChart');
    let landData = [];
    let chart;
    const initialDataLimit = 100;
    let zoomedIndex = -1;
    let originalData;
    const animationDuration = 250;
    let isZoomed = false;
    let currentChartType = 'bar';
    let activeFilters = [];
    let filterFields = [];
    let csvLabels = {
        plotNumber: 'Plot No.',
        area: 'Area',
        owner: 'Owner',
        // Add more default labels
    };

    // Theme handling
    const themeSwitch = document.getElementById('theme-switch');
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

    function initializeTheme() {
        const savedTheme = localStorage.getItem('theme') || 
                          (prefersDarkScheme.matches ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    
        // Update chart if it exists
         if (chart) {
        updateVisualization();
        }
    }

    themeSwitch.addEventListener('click', toggleTheme);
    initializeTheme();

    function setCanvasHeight() {
        canvas.style.height = `${window.innerHeight * 0.8}px`;
    }

    // File handling functionality
    const fileInputLabel = document.querySelector('.file-input-label');
    let selectedFile = null;

    // Create hidden file input
    const hiddenFileInput = document.createElement('input');
    hiddenFileInput.type = 'file';
    hiddenFileInput.accept = '.csv';
    hiddenFileInput.style.display = 'none';
    document.body.appendChild(hiddenFileInput);

    // Handle click on the label
    fileInputLabel.addEventListener('click', (e) => {
        e.preventDefault();
        hiddenFileInput.click();
    });

    // Handle file selection
    hiddenFileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files[0]);
    });

    // Drag and drop handlers
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Add visual feedback for drag events
    ['dragenter', 'dragover'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileInputLabel.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        fileInputLabel.classList.add('drag-active');
    }

    function unhighlight(e) {
        fileInputLabel.classList.remove('drag-active');
    }

    // Handle dropped files
    fileInputLabel.addEventListener('drop', (e) => {
        const droppedFile = e.dataTransfer.files[0];
        handleFileSelect(droppedFile);
    });

    // File selection handler
    function handleFileSelect(file) {
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            showNotification('Please select a CSV file', 'error');
            return;
        }

        selectedFile = file;
        updateFileLabel(file.name);
        importBtn.removeAttribute('disabled');
        showNotification('File selected successfully', 'success');
    }

    // Update the label to show selected filename
    function updateFileLabel(filename) {
        const uploadText = fileInputLabel.querySelector('.upload-text');
        const uploadSubtext = fileInputLabel.querySelector('.upload-subtext');
        uploadText.textContent = `Selected: ${filename}`;
        uploadSubtext.textContent = 'Click to change file';
    }

    // Import button click handler
    importBtn.addEventListener('click', () => {
        if (!selectedFile) {
            showNotification('Please select a file', 'error');
            return;
        }

        const reader = new FileReader();
        
        reader.onload = (e) => {
            const csvContent = e.target.result;
            console.log('File content length:', csvContent.length); // Debug log

            // Basic CSV content validation
            if (!csvContent || csvContent.trim().length === 0) {
                showNotification('The CSV file is empty', 'error');
                return;
            }

            showLoading();

            Papa.parse(csvContent, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true, // Automatically convert numbers
                complete: function(results) {
                    console.log('Parsing results:', results); // Debug log

                    if (results.errors && results.errors.length > 0) {
                        console.error('CSV parsing errors:', results.errors);
                        showNotification('Error in CSV format: ' + results.errors[0].message, 'error');
                        hideLoading();
                        return;
                    }

                    if (!results.data || results.data.length === 0) {
                        showNotification('No valid data found in the CSV file', 'error');
                        hideLoading();
                        return;
                    }

                    try {
                        // Store the parsed data
                        landData = results.data;
                        originalData = [...landData];

                        // Log the first row to verify data structure
                        console.log('First row of data:', landData[0]);

                        // Initialize data processing
                        const headers = Object.keys(landData[0]);
                        console.log('CSV Headers:', headers);

                        // Update CSV labels with the actual headers
                        csvLabels = headers.reduce((acc, header) => {
                            acc[header] = header.replace(/([A-Z])/g, ' $1')
                                              .replace(/^./, str => str.toUpperCase());
                            return acc;
                        }, {});

                        // Initialize filters and selectors
                        filterFields = headers;
                        initializeFilterFields(filterFields);
                        initializeAxisSelectors(landData);

                        // Show visualization page
                        page1.classList.add('hidden');
                        page2.classList.remove('hidden');

                        // Initialize visualization
                        setCanvasHeight();
                        updateVisualization();

                        showNotification('Data imported successfully', 'success');

                        // Scroll to filter section after successful import
                        const filterSection = document.querySelector('.filter-section');
                        if (filterSection) {
                            setTimeout(() => {
                                scrollToElement(filterSection);
                            }, 300); // Small delay to ensure DOM is updated
                        }

                    } catch (error) {
                        console.error('Data processing error:', error);
                        showNotification('Error processing data: ' + error.message, 'error');
                    } finally {
                        hideLoading();
                    }
                },
                error: function(error) {
                    console.error('PapaParse error:', error);
                    showNotification('Error parsing CSV: ' + error.message, 'error');
                    hideLoading();
                }
            });
        };

        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            showNotification('Error reading file: ' + error.message, 'error');
            hideLoading();
        };

        try {
            reader.readAsText(selectedFile);
        } catch (error) {
            console.error('File reading error:', error);
            showNotification('Error reading file: ' + error.message, 'error');
            hideLoading();
        }
    });

    function initializeFilterFields(fields) {
        const filterField = document.getElementById('filter-field');
        if (!filterField) {
            console.error('Filter field element not found');
            return;
        }
        
        // Clear existing options
        filterField.innerHTML = '';
        
        // Add default empty option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Field';
        filterField.appendChild(defaultOption);
        
        // Add options for each field
        fields.forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = csvLabels[field] || field;
            filterField.appendChild(option);
        });
        
        // Initialize operator options
        updateOperatorOptions();
    }

    function initializeAxisSelectors(data) {
        const xAxis = document.getElementById('x-axis');
        const yAxis = document.getElementById('y-axis');
        
        if (!xAxis || !yAxis) {
            console.error('Axis selector elements not found');
            return;
        }
        
        const headers = Object.keys(data[0] || {});
        
        // Clear existing options
        xAxis.innerHTML = '';
        yAxis.innerHTML = '';
        
        // Add empty option as first choice
        const xEmptyOption = document.createElement('option');
        const yEmptyOption = document.createElement('option');
        xEmptyOption.value = '';
        yEmptyOption.value = '';
        xEmptyOption.textContent = 'Select X-Axis';
        yEmptyOption.textContent = 'Select Y-Axis';
        xAxis.appendChild(xEmptyOption);
        yAxis.appendChild(yEmptyOption);
        
        // Add options for each header
        headers.forEach(header => {
            // X-Axis option
            const xOption = document.createElement('option');
            xOption.value = header;
            xOption.textContent = csvLabels[header] || header;
            xAxis.appendChild(xOption);
            
            // Y-Axis option (only add numeric fields)
            if (isNumericColumn(header)) {
                const yOption = document.createElement('option');
                yOption.value = header;
                yOption.textContent = csvLabels[header] || header;
                yAxis.appendChild(yOption);
            }
        });
        
        // Add change listeners
        xAxis.addEventListener('change', updateVisualization);
        yAxis.addEventListener('change', updateVisualization);
    }

    function isNumericColumn(field) {
        return landData.some(row => {
            const value = row[field];
            return !isNaN(parseFloat(value)) && isFinite(value);
        });
    }

    function updateOperatorOptions() {
        const filterField = document.getElementById('filter-field');
        const operatorSelect = document.getElementById('filter-operator');
        
        if (!filterField || !operatorSelect) {
            console.error('Filter elements not found');
            return;
        }
        
        const selectedField = filterField.value;
        operatorSelect.innerHTML = '';
        
        let operators;
        if (!selectedField) {
            operators = [];
        } else if (isNumericColumn(selectedField)) {
            operators = [
                { value: '=', text: 'Equals' },
                { value: '>', text: 'Greater Than' },
                { value: '<', text: 'Less Than' },
                { value: '>=', text: 'Greater Than or Equal' },
                { value: '<=', text: 'Less Than or Equal' },
                { value: '!=', text: 'Not Equal' }
            ];
        } else {
            operators = [
                { value: '=', text: 'Equals' },
                { value: '!=', text: 'Not Equal' },
                { value: 'contains', text: 'Contains' },
                { value: 'starts', text: 'Starts With' },
                { value: 'ends', text: 'Ends With' }
            ];
        }
        
        operators.forEach(op => {
            const option = document.createElement('option');
            option.value = op.value;
            option.textContent = op.text;
            operatorSelect.appendChild(option);
        });
    }

    // Make sure to add event listener for filter field change
    document.getElementById('filter-field')?.addEventListener('change', (e) => {
        updateOperatorOptions();
        updateAvailableValues(e.target.value);
    });

    function getColorForValue(value, min, max) {
        const ratio = (value - min) / (max - min);
        const hue = (1 - ratio) * 240; // 240 is blue, 0 is red
        return `hsl(${hue}, 70%, 50%)`;
    }

    function updateSummaryLabels() {
        const yAxisField = document.getElementById('y-axis').value;
        const xAxisField = document.getElementById('x-axis').value;
        const summaryElement = document.querySelector('.summary');
        
        if (!xAxisField || !yAxisField) {
            summaryElement.style.display = 'none';
            return;
        }
        
        summaryElement.style.display = 'block';
        
        // Calculate total of y-axis values
        const yTotal = landData.reduce((sum, item) => {
            const value = parseFloat(item[yAxisField]) || 0;
            return sum + value;
        }, 0);
        
        // Count unique x-axis values
        const uniqueXValues = new Set(landData.map(item => item[xAxisField])).size;
        
        // Update labels with dynamic field names
        summaryElement.innerHTML = `
            <p>Total ${csvLabels[yAxisField] || yAxisField}: <span>${yTotal.toLocaleString()}</span></p>
            <p>Number of ${csvLabels[xAxisField] || xAxisField}: <span>${uniqueXValues.toLocaleString()}</span></p>
        `;
    }

    function getChartColors(count, chartType) {
        const baseColors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF9F40'
        ];
        
        if (chartType === 'pie') {
            return baseColors.slice(0, count);
        }
        
        if (chartType === 'line' || chartType === 'area') {
            return {
                borderColor: baseColors[0],
                backgroundColor: chartType === 'area' ? 
                    `rgba(${hexToRgb(baseColors[0])}, 0.2)` : 
                    'transparent'
            };
        }
        
        // For bar charts, return gradient colors based on values
        return (context) => {
            const value = context.raw;
            const max = Math.max(...landData.map(d => parseFloat(d[document.getElementById('y-axis').value])));
            const min = Math.min(...landData.map(d => parseFloat(d[document.getElementById('y-axis').value])));
            const normalizedValue = (value - min) / (max - min);
            
            return getGradientColor(normalizedValue);
        };
    }

    function getGradientColor(value) {
        const colors = {
            low: [65, 151, 225],    // Blue
            mid: [248, 184, 61],    // Yellow
            high: [238, 96, 85]     // Red
        };
        
        let rgb;
        if (value < 0.5) {
            const ratio = value * 2;
            rgb = colors.low.map((low, i) => 
                Math.round(low + (colors.mid[i] - low) * ratio)
            );
        } else {
            const ratio = (value - 0.5) * 2;
            rgb = colors.mid.map((mid, i) => 
                Math.round(mid + (colors.high[i] - mid) * ratio)
            );
        }
        
        return `rgb(${rgb.join(',')})`;
    }

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? 
            `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : 
            '0, 0, 0';
    }

    function updateVisualization() {
        const xAxis = document.getElementById('x-axis').value;
        const yAxis = document.getElementById('y-axis').value;
        const visualizationSection = document.querySelector('.visualization');
        const currentTheme = document.documentElement.getAttribute('data-theme');
   
        // Hide visualization if axes aren't selected
        if (!xAxis || !yAxis) {
            visualizationSection.style.display = 'none';
            return;
        }
        
        // Show visualization if both axes are selected
        visualizationSection.style.display = 'block';
        
        const limitedData = landData.slice(0, initialDataLimit);
        
        const xValues = limitedData.map(row => row[xAxis]);
        const yValues = limitedData.map(row => parseFloat(row[yAxis]) || 0);
        
        const minY = Math.min(...yValues);
        const maxY = Math.max(...yValues);
        
        if (chart) {
            chart.destroy();
        }
        
        const ctx = document.getElementById('myChart').getContext('2d');
        const chartConfig = {
            type: currentChartType,
            data: {
                labels: xValues,
                datasets: [{
                    label: yAxis,
                    data: yValues,
                    backgroundColor: getChartColors(yValues.length, currentChartType),
                    borderColor: currentChartType === 'line' ? 
                        getChartColors(1, 'line').borderColor : 
                        'transparent',
                    borderWidth: 1,
                    fill: currentChartType === 'area'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    duration: animationDuration,
                    easing: 'easeOutQuad'
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: xAxis
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: yAxis
                        },
                        min: minY,
                        max: maxY + (maxY - minY) * 0.1
                    }
                }
            }
        };
        
        // Special configurations for different chart types
        if (currentChartType === 'pie') {
            chartConfig.options.scales = {}; // Remove scales for pie chart
        } else if (currentChartType === 'area') {
            chartConfig.type = 'line';
            chartConfig.data.datasets[0].fill = true;
        }
        
        chart = new Chart(ctx, chartConfig);
        
        // Update color legend
        const colorScale = document.querySelector('.color-scale');
        colorScale.style.background = `linear-gradient(to right, 
            ${getColorForValue(minY, minY, maxY)}, 
            ${getColorForValue(maxY, minY, maxY)})`;
        
        // Update summary labels after chart update
        updateSummaryLabels();
    }

    function getBarIndexFromEvent(event) {
        if (!chart) return -1; // Return -1 if no chart
        const points = chart.getElementsAtEventForMode(event,'nearest', { intersect: true }, true);

        if (points.length > 0) {
            return points[0].index
        }
        return -1;
    }

    function zoomChart(event) {
        if (!chart) return;

        const barIndex = getBarIndexFromEvent(event);
        if(barIndex === -1) return

        if(isZoomed) {
            zoomedIndex = -1;
            isZoomed = false
            landData = [...originalData];
            applyFilters()
            return
        }
        if(zoomedIndex === barIndex ) {
            return
        }
        const startIndex = Math.max(0, barIndex - 3);
        const endIndex = Math.min(landData.length, barIndex + 4);
        const zoomedData = originalData.slice(startIndex, endIndex);
        zoomedIndex = barIndex;
        isZoomed = true;
        updateVisualization();
    }

    canvas.addEventListener('wheel', (event) => {
        if (!chart || !event.ctrlKey) return;
        event.preventDefault();
        zoomChart(event);
    });
    canvas.addEventListener('dblclick', (event) => {
        if (!chart) return;
        zoomChart(event);
    });

    // Add graph type button handlers
    document.querySelectorAll('.graph-type-btn').forEach(button => {
        button.addEventListener('click', () => {
            document.querySelectorAll('.graph-type-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentChartType = button.dataset.type;
            updateVisualization();
        });
    });

    // Update CSV labels based on file content
    function updateCSVLabels(data) {
        if (!data || !data[0]) return;
        
        const headers = Object.keys(data[0]);
        csvLabels = headers.reduce((acc, header) => {
            // Convert header to a more readable format
            const label = header
                .split(/[_\s]+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            acc[header] = label;
            return acc;
        }, {});
        
        // Update UI elements with new labels
        updateUILabels();
    }

    function updateUILabels() {
        // Update axis labels
        document.querySelectorAll('.axis-selector label').forEach(label => {
            const forAttr = label.getAttribute('for');
            if (forAttr === 'x-axis') {
                label.textContent = 'X-Axis';
            } else if (forAttr === 'y-axis') {
                label.textContent = 'Y-Axis';
            }
        });
        
        // Update filter field options
        const filterField = document.getElementById('filter-field');
        Array.from(filterField.options).forEach(option => {
            if (option.value && csvLabels[option.value]) {
                option.textContent = csvLabels[option.value];
            }
        });
        
        // Update active filters display
        updateActiveFiltersList();
    }

    function updateAvailableValues(field) {
        const valueInput = document.getElementById('filter-value');
        const availableValues = new Set();
        
        // Get unique values for the selected field
        landData.forEach(row => {
            if (row[field] !== undefined && row[field] !== null) {
                availableValues.add(row[field]);
            }
        });
        
        // Create datalist for autocomplete
        let datalist = document.getElementById('available-values');
        if (!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = 'available-values';
            valueInput.parentNode.appendChild(datalist);
        }
        
        datalist.innerHTML = '';
        Array.from(availableValues)
            .sort()
            .forEach(value => {
                const option = document.createElement('option');
                option.value = value;
                datalist.appendChild(option);
            });
        
        valueInput.setAttribute('list', 'available-values');
    }

    // Verify PapaParse is loaded
    if (typeof Papa === 'undefined') {
        console.error('PapaParse is not loaded');
        showNotification('Error: Required library (PapaParse) not loaded', 'error');
    }

    // Remove apply-filters button event listener if it exists
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.remove();
    }

    // Update Clear All functionality
    document.getElementById('clear-filters')?.addEventListener('click', () => {
        activeFilters = [];
        updateActiveFiltersList();
        applyFilters(); // Apply empty filters to reset to original data
        
        // Clear input fields
        document.getElementById('filter-field').value = '';
        document.getElementById('filter-operator').value = '';
        document.getElementById('filter-value').value = '';
        
        showNotification('All filters cleared', 'info');
    });

    // Update Add Filter functionality
    document.getElementById('add-filter')?.addEventListener('click', () => {
        const field = document.getElementById('filter-field').value;
        const operator = document.getElementById('filter-operator').value;
        const value = document.getElementById('filter-value').value;

        if (!field || !operator || !value) {
            showNotification('Please fill in all filter fields', 'error');
            return;
        }

        // Check for duplicate filter
        const isDuplicate = activeFilters.some(filter => 
            filter.field === field && 
            filter.value.toString().toLowerCase() === value.toString().toLowerCase()
        );

        if (isDuplicate) {
            showNotification('A filter with this field and value already exists', 'error');
            return;
        }

        const newFilter = { field, operator, value };
        activeFilters.push(newFilter);
        
        // Immediately apply filters
        applyFilters();
        
        // Update UI
        updateActiveFiltersList();
        
        // Clear filter inputs
        document.getElementById('filter-field').value = '';
        document.getElementById('filter-operator').value = '';
        document.getElementById('filter-value').value = '';
        
        showNotification('Filter added and applied', 'success');
    });

    // Update the applyFilters function
    function applyFilters() {
        if (activeFilters.length === 0) {
            landData = [...originalData];
        } else {
            landData = originalData.filter(row => {
                return activeFilters.every(filter => {
                    const value = row[filter.field];
                    const filterValue = filter.value;

                    // Handle null or undefined values
                    if (value === null || value === undefined) {
                        return false;
                    }

                    // Convert both values to lowercase strings for comparison
                    const normalizedValue = value.toString().toLowerCase();
                    const normalizedFilterValue = filterValue.toString().toLowerCase();

                    switch (filter.operator) {
                        case '=':
                            return normalizedValue === normalizedFilterValue;
                        case '!=':
                            return normalizedValue !== normalizedFilterValue;
                        case '>':
                            return !isNaN(value) && !isNaN(filterValue) && 
                                   parseFloat(value) > parseFloat(filterValue);
                        case '<':
                            return !isNaN(value) && !isNaN(filterValue) && 
                                   parseFloat(value) < parseFloat(filterValue);
                        case '>=':
                            return !isNaN(value) && !isNaN(filterValue) && 
                                   parseFloat(value) >= parseFloat(filterValue);
                        case '<=':
                            return !isNaN(value) && !isNaN(filterValue) && 
                                   parseFloat(value) <= parseFloat(filterValue);
                        case 'contains':
                            return normalizedValue.includes(normalizedFilterValue);
                        case 'starts':
                            return normalizedValue.startsWith(normalizedFilterValue);
                        case 'ends':
                            return normalizedValue.endsWith(normalizedFilterValue);
                        default:
                            return true;
                    }
                });
            });
        }

        // Update visualization after applying filters
        updateVisualization();
        
        // Show feedback about number of filtered results
        const filteredCount = landData.length;
        const totalCount = originalData.length;
        showNotification(
            `Showing ${filteredCount} of ${totalCount} records`,
            filteredCount === 0 ? 'warning' : 'info'
        );
    }

    function updateActiveFiltersList() {
        const filtersList = document.getElementById('active-filters-list');
        if (!filtersList) return;

        filtersList.innerHTML = '';
        
        activeFilters.forEach((filter, index) => {
            const filterElement = document.createElement('div');
            filterElement.className = 'active-filter';
            filterElement.innerHTML = `
                <span>${csvLabels[filter.field] || filter.field} ${filter.operator} ${filter.value}</span>
                <div class="filter-actions">
                    <button class="edit-filter" data-index="${index}" aria-label="Edit filter">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                        </svg>
                    </button>
                    <button class="remove-filter" data-index="${index}" aria-label="Remove filter">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                        </svg>
                    </button>
                </div>
            `;
            filtersList.appendChild(filterElement);

            // Update remove button handler
            const removeBtn = filterElement.querySelector('.remove-filter');
            removeBtn.addEventListener('click', () => {
                activeFilters.splice(index, 1);
                updateActiveFiltersList();
                applyFilters(); // Immediately apply updated filters
                showNotification('Filter removed', 'info');
            });
        });

        document.querySelectorAll('.edit-filter').forEach(button => {
            button.addEventListener('click', () => {
                const filter = activeFilters[parseInt(button.dataset.index)];
                document.getElementById('filter-field').value = filter.field;
                updateOperatorOptions();
                document.getElementById('filter-operator').value = filter.operator;
                document.getElementById('filter-value').value = filter.value;
                activeFilters.splice(parseInt(button.dataset.index), 1);
                updateActiveFiltersList();
                applyFilters();
                showNotification('Filter ready to edit', 'info');
            });
        });
    }

    // Add this function for smooth scrolling
    function scrollToElement(element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }

    // Add this notification system implementation at the top level
    function showNotification(message, type = 'info') {
        // Remove any existing notifications first
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification container if it doesn't exist
        let notificationContainer = document.querySelector('.notification-container');
        if (!notificationContainer) {
            notificationContainer = document.createElement('div');
            notificationContainer.className = 'notification-container';
            document.body.appendChild(notificationContainer);
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Add icon based on type
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
        `;
        
        notificationContainer.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Remove notification after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    // Update the CSV import success handler
    function handleSuccessfulImport(results) {
        try {
            // Store the parsed data
            landData = results.data;
            originalData = [...landData];

            // Initialize data processing
            const headers = Object.keys(landData[0]);
            
            // Update CSV labels
            csvLabels = headers.reduce((acc, header) => {
                acc[header] = header.replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, str => str.toUpperCase());
                return acc;
            }, {});

            // Initialize filters and selectors
            filterFields = headers;
            initializeFilterFields(filterFields);
            initializeAxisSelectors(landData);

            // Show visualization page
            page1.classList.add('hidden');
            page2.classList.remove('hidden');

            // Initialize visualization
            setCanvasHeight();
            updateVisualization();

            // Show success notification
            showNotification('Data imported successfully', 'success');

            // Scroll to filter section after a short delay
            setTimeout(() => {
                const filterSection = document.querySelector('.filter-section');
                if (filterSection) {
                    filterSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 500);

        } catch (error) {
            console.error('Data processing error:', error);
            showNotification('Error processing data: ' + error.message, 'error');
        }
    }

    // Add loading indicator during file import and processing
    function showLoading() {
        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-overlay';
        loadingEl.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">Processing Data...</div>
        `;
        document.body.appendChild(loadingEl);
    }

    function hideLoading() {
        const loadingEl = document.querySelector('.loading-overlay');
        if (loadingEl) loadingEl.remove();
    }

    function addTooltips() {
        const tooltips = {
            'filter-field': 'Select a column to filter',
            'filter-operator': 'Choose how to filter the data',
            'filter-value': 'Enter the value to filter by',
            'x-axis': 'Select the data for horizontal axis',
            'y-axis': 'Select the data for vertical axis'
        };

        Object.entries(tooltips).forEach(([id, text]) => {
            const element = document.getElementById(id);
            if (element) {
                element.title = text;
            }
        });
    }

    function showEmptyState(container, message) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <svg class="empty-icon" viewBox="0 0 24 24">
                <path d="M20 6h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zM10 4h4v2h-4V4z"/>
            </svg>
            <p>${message}</p>
        `;
        container.appendChild(emptyState);
    }

    function enhanceFilterControls() {
        const filterValue = document.getElementById('filter-value');
        
        // Add debounce to value input
        let timeout;
        filterValue.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                updateAvailableValues(e.target.value);
            }, 300);
        });
    }

    // Add these to your existing file input handling code
    function initializeFileInput() {
        const fileLabel = document.querySelector('.file-input-label');
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            fileLabel.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            fileLabel.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            fileLabel.addEventListener('dragleave', unhighlight, false);
        });

        function highlight(e) {
            fileLabel.classList.add('drag-active');
        }

        function unhighlight(e) {
            fileLabel.classList.remove('drag-active');
        }
    }

    // Call this function when the page loads
    document.addEventListener('DOMContentLoaded', initializeFileInput);

    // Add these variables at the top with your other global variables
   
    // Add these event listeners after chart initialization
    document.getElementById('lowColor').addEventListener('change', (e) => {
        const newColor = e.target.value;
        updateChartColors(newColor, document.getElementById('highColor').value);
    });

    document.getElementById('highColor').addEventListener('change', (e) => {
        const newColor = e.target.value;
        updateChartColors(document.getElementById('lowColor').value, newColor);
    });

    function updateChartColors(lowColor, highColor) {
        if (!chart) return;
        
        // Update the color scale
        const colorScale = document.querySelector('.color-scale');
        if (colorScale) {
            colorScale.style.background = `linear-gradient(to right, ${lowColor}, ${highColor})`;
        }
        
        // Update chart colors based on chart type
        if (chart.config.type === 'bar') {
            chart.data.datasets[0].backgroundColor = (context) => {
                const value = context.raw;
                const max = Math.max(...landData.map(d => parseFloat(d[document.getElementById('y-axis').value])));
                const min = Math.min(...landData.map(d => parseFloat(d[document.getElementById('y-axis').value])));
                const normalizedValue = (value - min) / (max - min);
                
                return getGradientColor(normalizedValue, lowColor, highColor);
            };
        } else if (chart.config.type === 'line') {
            chart.data.datasets[0].borderColor = lowColor;
            if (currentChartType === 'area') {
                chart.data.datasets[0].backgroundColor = hexToRgba(highColor, 0.2);
            }
        } else if (chart.config.type === 'pie') {
            chart.data.datasets[0].backgroundColor = generateColorArray(chart.data.labels.length, lowColor, highColor);
        }
        
        chart.update();
    }

    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function generateColorArray(count, startColor, endColor) {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const ratio = i / (count - 1);
            colors.push(getGradientColor(ratio, startColor, endColor));
        }
        return colors;
    }
});
