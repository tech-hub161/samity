function getBalance(customerName, selectedDate) {
    let balance = 0;
    const selected = new Date(selectedDate);
    for (let key in localStorage) {
        if (key.startsWith('records_')) {
            const dateStr = key.replace('records_', '');
            const recordDate = new Date(dateStr);
            if (recordDate <= selected) {
                const data = JSON.parse(localStorage.getItem(key));
                data.forEach(record => {
                    if (record.name === customerName) {
                        balance += parseFloat(record.deposit) || 0;
                    }
                });
            }
        }
    }
    return balance;
}

function addDepositListener(row) {
    const depositInput = row.cells[3].querySelector('input');
    const khataInput = row.cells[2].querySelector('input');
    const loanInput = row.cells[6].querySelector('input');
    const loanFineInput = row.cells[7].querySelector('input');
    const parishodhInput = row.cells[8].querySelector('input');
    const updateCalculations = () => {
        const deposit = parseFloat(depositInput.value) || 0;
        const khata = parseFloat(khataInput.value) || 0;
        const loan = parseFloat(loanInput.value) || 0;
        const loanFine = parseFloat(loanFineInput.value) || 0;
        const parishodh = parseFloat(parishodhInput.value) || 0;
        row.cells[5].textContent = deposit * khata; // Balance
        row.cells[9].textContent = loan - parishodh + loanFine; // Total Outstanding
    };
    depositInput.addEventListener('input', updateCalculations);
    khataInput.addEventListener('input', updateCalculations);
    loanInput.addEventListener('input', updateCalculations);
    loanFineInput.addEventListener('input', updateCalculations);
    parishodhInput.addEventListener('input', updateCalculations);
    // Do not set initial to preserve carried over values
}

function getLatestPreviousDate(selectedDate) {
    const selected = new Date(selectedDate);
    let latestDate = null;
    for (let key in localStorage) {
        if (key.startsWith('records_')) {
            const dateStr = key.replace('records_', '');
            const recordDate = new Date(dateStr);
            if (recordDate < selected && (!latestDate || recordDate > latestDate)) {
                latestDate = recordDate;
            }
        }
    }
    return latestDate ? latestDate.toISOString().split('T')[0] : null;
}

function loadData(selectedDate) {
    const tbody = document.querySelector('#customer-table tbody');
    tbody.innerHTML = ''; // Clear existing rows
    let data = JSON.parse(localStorage.getItem(`records_${selectedDate}`)) || [];
    const isSaved = data.length > 0;
    if (!isSaved) {
        const prevDate = getLatestPreviousDate(selectedDate);
        if (prevDate) {
            data = JSON.parse(localStorage.getItem(`records_${prevDate}`)) || [];
        }
    }
    data.forEach((record, index) => {
        const newRow = tbody.insertRow();
        if (isSaved) {
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" value="${record.name}" placeholder="Name"></td>
                <td><input type="text" class="khata-input" maxlength="2" value="${record.khata}" placeholder="Khata"></td>
                <td><input type="number" value="${record.deposit}" placeholder="Deposit"></td>
                <td><input type="number" value="${record.depositFine}" placeholder="Deposit Fine"></td>
                <td class="balance">${record.balance}</td>
                <td><input type="number" value="${record.loan}" placeholder="Loan"></td>
                <td><input type="number" value="${record.loanFine}" placeholder="Loan Fine"></td>
                <td><input type="number" value="${record.parishodh}" placeholder="Parishodh"></td>
                <td class="total-outstanding">${record.totalOutstanding}</td>
            `;
        } else {
            newRow.innerHTML = `
                <td>${index + 1}</td>
                <td><input type="text" value="${record.name}" placeholder="Name"></td>
                <td><input type="text" class="khata-input" maxlength="2" value="${record.khata}" placeholder="Khata"></td>
                <td><input type="number" placeholder="Deposit"></td>
                <td><input type="number" placeholder="Deposit Fine"></td>
                <td class="balance">${record.balance || 0}</td>
                <td><input type="number" placeholder="Loan"></td>
                <td><input type="number" placeholder="Loan Fine"></td>
                <td><input type="number" placeholder="Parishodh"></td>
                <td class="total-outstanding">${record.totalOutstanding || 0}</td>
            `;
        }
        addDepositListener(newRow);
    });
}

document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('calendar-picker').value = today;
    loadData(today);
});

document.getElementById('calendar-picker').addEventListener('change', function() {
    const selectedDate = this.value;
    if (selectedDate) {
        loadData(selectedDate);
    } else {
        document.querySelector('#customer-table tbody').innerHTML = '';
    }
});

document.getElementById('logout-btn').addEventListener('click', function() {
    // Placeholder: redirect to login or clear session
    alert('Logged out successfully.');
    // window.location.href = 'login.html'; // Uncomment and create login.html if needed
});

document.getElementById('report-btn').addEventListener('click', function() {
    const selectedDate = document.getElementById('calendar-picker').value;
    if (selectedDate) {
        alert(`Generating report for ${selectedDate}`);
        // Placeholder: implement actual report generation logic here
    } else {
        alert('Please select a date for the report.');
    }
});

document.getElementById('add-btn').addEventListener('click', function() {
    const selectedDate = document.getElementById('calendar-picker').value;
    if (!selectedDate) {
        alert('Please select a date first.');
        return;
    }
    const customerName = prompt('Enter customer name:');
    if (customerName) {
        const tbody = document.querySelector('#customer-table tbody');
        const rowCount = tbody.rows.length + 1;
        const newRow = tbody.insertRow();
        newRow.innerHTML = `
            <td>${rowCount}</td>
            <td><input type="text" value="${customerName}" placeholder="Name"></td>
            <td><input type="text" class="khata-input" maxlength="2" placeholder="Khata"></td>
            <td><input type="number" placeholder="Deposit"></td>
            <td><input type="number" placeholder="Deposit Fine"></td>
            <td class="balance">0</td>
            <td><input type="number" placeholder="Loan"></td>
            <td><input type="number" placeholder="Loan Fine"></td>
            <td><input type="number" placeholder="Parishodh"></td>
            <td class="total-outstanding">0</td>
        `;
        addDepositListener(newRow);
    }
});

document.getElementById('save-btn').addEventListener('click', function() {
    const selectedDate = document.getElementById('calendar-picker').value;
    if (!selectedDate) {
        alert('Please select a date before saving.');
        return;
    }
    const tbody = document.querySelector('#customer-table tbody');
    const data = [];
    for (let row of tbody.rows) {
        const cells = row.cells;
        data.push({
            slNo: cells[0].textContent,
            name: cells[1].querySelector('input').value,
            khata: cells[2].querySelector('input').value,
            deposit: cells[3].querySelector('input').value,
            depositFine: cells[4].querySelector('input').value,
            balance: cells[5].textContent,
            loan: cells[6].querySelector('input').value,
            loanFine: cells[7].querySelector('input').value,
            parishodh: cells[8].querySelector('input').value,
            totalOutstanding: cells[9].textContent
        });
    }
    localStorage.setItem(`records_${selectedDate}`, JSON.stringify(data));
    alert('Records saved successfully for ' + selectedDate);
    loadData(selectedDate); // Reload to reflect calculations
});
