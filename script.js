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

    importBtn.addEventListener('click', () => {
        if (!csvFile.files[0]) {
            alert("Please select a file");
            return;
        }
        const file = csvFile.files[0];
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                landData = results.data;
                originalData = [...landData];
                if (landData && landData.length > 0) {
                    updateCSVLabels(landData);
                    page1.classList.add('hidden');
                    page2.classList.remove('hidden');
                    setCanvasHeight();
                    initializeFilters(landData);
                    initializeAxisSelectors(landData);
                    updateVisualization();
                    window.addEventListener('resize', setCanvasHeight);
                } else {
                    alert("No data found in CSV file");
                }
            },
            error: function(error) {
                console.error('Error parsing CSV:', error.message);
                alert("There was a problem reading the csv file ");
            }
        });
    });

    function initializeFilters(data) {
        const filterField = document.getElementById('filter-field');
        filterFields = Object.keys(data[0] || {});
        
        // Populate filter fields dropdown
        filterField.innerHTML = '<option value="">Select Field</option>';
        filterFields.forEach(field => {
            const option = document.createElement('option');
            option.value = field;
            option.textContent = field;
            filterField.appendChild(option);
        });

        // Event Listeners
        document.getElementById('add-filter').addEventListener('click', addNewFilter);
        document.getElementById('apply-filters').addEventListener('click', applyFilters);
        document.getElementById('clear-filters').addEventListener('click', clearFilters);
        
        // Update operator options based on field type
        filterField.addEventListener('change', updateOperatorOptions);
    }

    function updateOperatorOptions() {
        const field = document.getElementById('filter-field').value;
        const operatorSelect = document.getElementById('filter-operator');
        const sampleValue = landData[0]?.[field];
        
        operatorSelect.innerHTML = '';
        
        // Improved number detection
        const isNumber = !isNaN(parseFloat(sampleValue)) && isFinite(sampleValue);
        
        const operators = isNumber ? 
            [
                { value: 'equals', label: 'Equals' },
                { value: 'not-equals', label: 'Not Equals' },
                { value: 'greater-than', label: 'Greater Than' },
                { value: 'less-than', label: 'Less Than' }
            ] :
            [
                { value: 'equals', label: 'Equals' },
                { value: 'not-equals', label: 'Not Equals' },
                { value: 'contains', label: 'Contains' }
            ];
        
        operators.forEach(op => {
            const option = document.createElement('option');
            option.value = op.value;
            option.textContent = op.label;
            operatorSelect.appendChild(option);
        });
    }

    function addNewFilter() {
        const field = document.getElementById('filter-field').value;
        const operator = document.getElementById('filter-operator').value;
        const value = document.getElementById('filter-value').value;
        
        if (!field || !operator || !value) {
            showNotification('Please fill all filter fields', 'error');
            return;
        }
        
        const filterId = `filter-${Date.now()}`;
        const filter = { id: filterId, field, operator, value };
        activeFilters.push(filter);
        
        updateActiveFiltersList();
        clearFilterInputs();
    }

    function updateActiveFiltersList() {
        const filtersList = document.getElementById('active-filters-list');
        filtersList.innerHTML = '';
        
        activeFilters.forEach(filter => {
            const filterElement = document.createElement('div');
            filterElement.className = 'active-filter';
            filterElement.innerHTML = `
                <span>${csvLabels[filter.field] || filter.field} ${filter.operator} ${filter.value}</span>
                <div class="filter-actions">
                    <button class="edit-filter" data-id="${filter.id}">
                        <svg viewBox="0 0 24 24" width="14" height="14">
                            <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                        </svg>
                    </button>
                    <button class="remove-filter" data-id="${filter.id}">×</button>
                </div>
            `;
            filtersList.appendChild(filterElement);
        });

        // Add event listeners for edit and remove buttons
        document.querySelectorAll('.remove-filter').forEach(button => {
            button.addEventListener('click', () => removeFilter(button.dataset.id));
        });

        document.querySelectorAll('.edit-filter').forEach(button => {
            button.addEventListener('click', () => editFilter(button.dataset.id));
        });
    }

    function editFilter(filterId) {
        const filter = activeFilters.find(f => f.id === filterId);
        if (!filter) return;

        // Populate filter inputs with current values
        document.getElementById('filter-field').value = filter.field;
        updateOperatorOptions(); // Update operators based on field type
        document.getElementById('filter-operator').value = filter.operator;
        document.getElementById('filter-value').value = filter.value;
        
        // Remove the old filter
        removeFilter(filterId);
        
        // Update available values dropdown
        updateAvailableValues(filter.field);
    }

    function removeFilter(filterId) {
        activeFilters = activeFilters.filter(f => f.id !== filterId);
        updateActiveFiltersList();
    }

    function clearFilters() {
        activeFilters = [];
        updateActiveFiltersList();
        landData = [...originalData];
        updateVisualization();
        showNotification('All filters cleared', 'success');
    }

    function applyFilters() {
        let filteredData = [...originalData];
        
        activeFilters.forEach(filter => {
            filteredData = filteredData.filter(row => {
                const value = row[filter.field];
                const filterValue = filter.value;
                
                switch (filter.operator) {
                    case 'equals':
                        return value === filterValue;
                    case 'not-equals':
                        return value !== filterValue;
                    case 'contains':
                        return value.toLowerCase().includes(filterValue.toLowerCase());
                    case 'greater-than':
                        return parseFloat(value) > parseFloat(filterValue);
                    case 'less-than':
                        return parseFloat(value) < parseFloat(filterValue);
                    default:
                        return true;
                }
            });
        });
        
        landData = filteredData;
        updateVisualization();
        showNotification(`Showing ${filteredData.length} results`, 'success');
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 2000);
        }, 100);
    }

    function clearFilterInputs() {
        document.getElementById('filter-field').value = '';
        document.getElementById('filter-operator').value = 'equals';
        document.getElementById('filter-value').value = '';
    }

    function initializeAxisSelectors(data) {
        const xAxis = document.getElementById('x-axis');
        const yAxis = document.getElementById('y-axis');
        const headers = Object.keys(data[0] || {});
        
        // Clear existing options
        xAxis.innerHTML = '';
        yAxis.innerHTML = '';
        
        // Add empty option as first choice
        const xEmptyOption = document.createElement('option');
        const yEmptyOption = document.createElement('option');
        xEmptyOption.value = '';
        yEmptyOption.value = '';
        xEmptyOption.text = 'Select X-Axis';
        yEmptyOption.text = 'Select Y-Axis';
        xAxis.appendChild(xEmptyOption);
        yAxis.appendChild(yEmptyOption);
        
        // Function to check if a column has numeric values
        function isNumericColumn(header) {
            return data.some(row => {
                const value = row[header];
                return !isNaN(value) && value !== '' && value !== null;
            });
        }
        
        headers.forEach(header => {
            // Add option to X-axis
            const xOption = document.createElement('option');
            xOption.value = header;
            xOption.text = csvLabels[header] || header;
            xAxis.appendChild(xOption);
            
            // Add option to Y-axis only if column contains numeric values
            if (isNumericColumn(header)) {
                const yOption = document.createElement('option');
                yOption.value = header;
                yOption.text = csvLabels[header] || header;
                yAxis.appendChild(yOption);
            }
        });
        
        // Set initial values to empty
        xAxis.value = '';
        yAxis.value = '';
        
        // Add change listeners
        xAxis.addEventListener('change', () => updateVisualization());
        yAxis.addEventListener('change', () => updateVisualization());
        
        // Initial update to hide visualization
        updateVisualization();
    }

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

    // Update the filter field change handler
    document.getElementById('filter-field').addEventListener('change', (e) => {
        updateOperatorOptions();
        updateAvailableValues(e.target.value);
    });
});