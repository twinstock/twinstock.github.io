class StockCalculator {
    constructor() {
        this.portfolio = new Map(); // 종목별 보유 정보
        this.transactions = []; // 모든 거래 내역
        this.chart = null;
        this.currentModalStock = null;
        this.includeRealizedPnlInAvgCost = true; // 실현 손익 포함 여부 (기본값 true)
        
        this.initializeEventListeners();
        this.loadFromLocalStorage();
        this.updateDatalist(); // 초기 로드 시 datalist 업데이트
        this.updateDisplay();
    }

    initializeEventListeners() {
        const form = document.getElementById('transactionForm');
        form.addEventListener('submit', (e) => this.handleTransactionSubmit(e));
        
        // 모달 이벤트 리스너
        const modal = document.getElementById('transactionModal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeModal();
        });
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
        });

        // 포트폴리오 저장/불러오기 버튼 이벤트 리스너
        const saveButton = document.getElementById('savePortfolio');
        const loadButton = document.getElementById('loadPortfolio');
        const loadInput = document.getElementById('loadPortfolioInput');

        saveButton.addEventListener('click', () => this.savePortfolioToFile());
        loadButton.addEventListener('click', () => loadInput.click());
        loadInput.addEventListener('change', (e) => this.loadPortfolioFromFile(e.target.files[0]));
        
        // 대량 거래 내역 추가 버튼 (모달 열기) 이벤트 리스너
        const openBulkTransactionModalBtn = document.getElementById('openBulkTransactionModal');
        openBulkTransactionModalBtn.addEventListener('click', () => this.openBulkTransactionModal());

        // 대량 거래 내역 모달 닫기 버튼 이벤트 리스너
        const closeBulkTransactionModalBtn = document.getElementById('closeBulkTransactionModal');
        const bulkTransactionModal = document.getElementById('bulkTransactionModal');

        closeBulkTransactionModalBtn.addEventListener('click', () => this.closeBulkTransactionModal());
        bulkTransactionModal.addEventListener('click', (e) => {
            if (e.target === bulkTransactionModal) this.closeBulkTransactionModal();
        });

        // ESC 키로 대량 거래 내역 모달 닫기
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && bulkTransactionModal.style.display === 'block') {
                this.closeBulkTransactionModal();
            }
        });

        // 대량 거래 추가 버튼 (모달 내부) 이벤트 리스너
        const addBulkTransactionsButton = document.getElementById('addBulkTransactions');
        addBulkTransactionsButton.addEventListener('click', () => {
            const bulkText = document.getElementById('bulkTransactionText').value;
            const stockName = document.getElementById('bulkStockName').value.trim();
            if (!stockName) {
                alert('대량 거래를 추가할 종목명을 입력해주세요.');
                return;
            }
            this.parseAndAddTransactions(bulkText, stockName);
            document.getElementById('bulkTransactionText').value = ''; // 입력창 초기화
            this.closeBulkTransactionModal(); // 모달 닫기
        });
        
        // 실현 손익 포함 체크박스 이벤트 리스너 (새로운 위치)
        const pnlCheckbox = document.getElementById('includeRealizedPnlInAvgCost');
        if (pnlCheckbox) {
            pnlCheckbox.checked = this.includeRealizedPnlInAvgCost;
            pnlCheckbox.addEventListener('change', (e) => {
                this.includeRealizedPnlInAvgCost = e.target.checked;
                this.saveToLocalStorage();
                this.recalculatePortfolio();
                this.updateDisplay();
            });
        }

        // 도움말 버튼 이벤트 리스너
        const openHelpModalBtn = document.getElementById('openHelpModal');
        if (openHelpModalBtn) {
            openHelpModalBtn.addEventListener('click', () => this.openHelpModal());
        }

        // 문의하기 버튼 이벤트 리스너
        const contactUsBtn = document.getElementById('contactUsBtn');
        if (contactUsBtn) {
            contactUsBtn.addEventListener('click', () => {
                window.location.href = 'mailto:qwerasdf5190@gmail.com';
            });
        }
    }

    openBulkTransactionModal() {
        const bulkTransactionModal = document.getElementById('bulkTransactionModal');
        bulkTransactionModal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 스크롤 방지
    }

    closeBulkTransactionModal() {
        const bulkTransactionModal = document.getElementById('bulkTransactionModal');
        bulkTransactionModal.style.display = 'none';
        document.body.style.overflow = 'auto'; // 스크롤 복원
        // 모달 닫을 때 입력 필드 초기화
        document.getElementById('bulkStockName').value = '';
        document.getElementById('bulkTransactionText').value = '';
    }

    updateDatalist() {
        const datalist = document.getElementById('stockNames');
        datalist.innerHTML = ''; // 기존 옵션 초기화

        const uniqueStockNames = new Set(this.transactions.map(t => t.stockName));
        this.portfolio.forEach((_, stockName) => uniqueStockNames.add(stockName));

        uniqueStockNames.forEach(stockName => {
            const option = document.createElement('option');
            option.value = stockName;
            datalist.appendChild(option);
        });
    }

    handleTransactionSubmit(e) {
        e.preventDefault();
        
        const stockName = document.getElementById('stockName').value.trim();
        const quantity = parseInt(document.getElementById('quantity').value);
        const price = parseFloat(document.getElementById('price').value);
        const type = document.getElementById('transactionType').value;
        
        if (!stockName || !quantity || !price) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        this.addTransaction(stockName, quantity, price, type);
        form.reset();
    }

    addTransaction(stockName, quantity, price, type) {
        const transaction = {
            id: Date.now(),
            stockName,
            quantity,
            price,
            type,
            date: new Date().toISOString()
        };
        
        this.transactions.push(transaction);
        this.updatePortfolio(stockName, quantity, price, type);
        this.saveToLocalStorage();
        this.updateDisplay();
    }

    updatePortfolio(stockName, quantity, price, type) {
        if (!this.portfolio.has(stockName)) {
            this.portfolio.set(stockName, {
                totalQuantity: 0,
                totalCost: 0,
                averagePrice: 0,
                currentPrice: price // 현재가로 가정
            });
        }
        
        const stock = this.portfolio.get(stockName);
        
        if (type === 'buy') {
            // 매수: 평단가 계산
            const newTotalQuantity = stock.totalQuantity + quantity;
            const newTotalCost = stock.totalCost + (quantity * price);
            stock.totalQuantity = newTotalQuantity;
            stock.totalCost = newTotalCost;
            stock.averagePrice = newTotalCost / newTotalQuantity;
        } else {
            // 매도: 수량 감소
            if (stock.totalQuantity < quantity) {
                alert('보유 수량보다 많은 수량을 매도할 수 없습니다.');
                return;
            }
            
            const remainingQuantity = stock.totalQuantity - quantity;
            let remainingCost;
            
            if (this.includeRealizedPnlInAvgCost) {
                // 실현 손익 포함하여 계산: 총 투자금액에서 매도 금액만큼 차감
                remainingCost = stock.totalCost - (quantity * price);
            } else {
                // 기존 방식: 매도한 수량의 평단가만큼 총 투자금액에서 차감
                remainingCost = stock.totalCost - (quantity * stock.averagePrice);
            }
            
            stock.totalQuantity = remainingQuantity;
            stock.totalCost = remainingCost;
            
            if (remainingQuantity === 0) {
                stock.averagePrice = 0;
            } else {
                stock.averagePrice = remainingCost / remainingQuantity;
            }
        }
        
        // 보유 수량이 0이면 포트폴리오에서 제거
        if (stock.totalQuantity === 0) {
            this.portfolio.delete(stockName);
        }
    }

    updateDisplay() {
        this.updatePortfolioSummary();
        this.updateStocksList();
        this.updateChart();
        this.updateDatalist(); // 데이터리스트 업데이트
    }

    updatePortfolioSummary() {
        const totalStocks = this.portfolio.size;
        const totalInvestment = Array.from(this.portfolio.values())
            .reduce((sum, stock) => sum + stock.totalCost, 0);
        const totalValue = Array.from(this.portfolio.values())
            .reduce((sum, stock) => sum + (stock.totalQuantity * stock.currentPrice), 0);
        const profitRate = totalInvestment > 0 ? 
            ((totalValue - totalInvestment) / totalInvestment * 100) : 0;

        document.getElementById('totalStocks').textContent = totalStocks.toLocaleString();
        document.getElementById('totalInvestment').textContent = totalInvestment.toLocaleString();
        document.getElementById('totalValue').textContent = totalValue.toLocaleString();
        
        const profitRateElement = document.getElementById('profitRate');
        profitRateElement.textContent = profitRate.toFixed(2);
        profitRateElement.className = profitRate >= 0 ? 'profit-positive' : 'profit-negative';
    }

    updateStocksList() {
        const stocksList = document.getElementById('stocksList');
        
        if (this.portfolio.size === 0) {
            stocksList.innerHTML = `
                <div class="empty-state">
                    <p>아직 거래 내역이 없습니다.</p>
                    <p>위에서 첫 번째 거래를 추가해보세요!</p>
                </div>
            `;
            return;
        }
        
        stocksList.innerHTML = '';
        
        for (const [stockName, stock] of this.portfolio) {
            const currentValue = stock.totalQuantity * stock.currentPrice;
            const profit = currentValue - stock.totalCost;
            const profitRate = stock.totalCost > 0 ? (profit / stock.totalCost * 100) : 0;
            
            const stockItem = document.createElement('div');
            stockItem.className = 'stock-item';
            stockItem.style.cursor = 'pointer';
            stockItem.addEventListener('click', () => this.showTransactionModal(stockName));
            stockItem.innerHTML = `
                <div class="stock-info">
                    <h3>${stockName}</h3>
                    <div class="stock-actions">
                        <button class="btn-secondary btn-small" onclick="event.stopPropagation(); stockCalculator.showPriceInputModal('${stockName}')">
                            현재가 입력
                        </button>
                        <button class="btn-danger btn-small" onclick="event.stopPropagation(); stockCalculator.removeStock('${stockName}')">
                            삭제
                        </button>
                    </div>
                    <div class="stock-details">
                        <div class="stock-detail">
                            <strong>보유 수량</strong>
                            <span>${stock.totalQuantity.toLocaleString()}주</span>
                        </div>
                        <div class="stock-detail">
                            <strong>평단가</strong>
                            <span>${stock.averagePrice.toLocaleString()}달러</span>
                        </div>
                        <div class="stock-detail">
                            <strong>현재가</strong>
                            <span>${stock.currentPrice.toLocaleString()}달러</span>
                        </div>
                        <div class="stock-detail">
                            <strong>평가금액</strong>
                            <span>${currentValue.toLocaleString()}달러</span>
                        </div>
                        <div class="stock-detail">
                            <strong>수익/손실</strong>
                            <span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                                ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}달러
                            </span>
                        </div>
                        <div class="stock-detail">
                            <strong>수익률</strong>
                            <span class="${profitRate >= 0 ? 'profit-positive' : 'profit-negative'}">
                                ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%
                            </span>
                        </div>
                    </div>
                </div>
            `;
            
            stocksList.appendChild(stockItem);
        }
    }

    updateChart() {
        const ctx = document.getElementById('portfolioChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        if (this.portfolio.size === 0) {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '16px Noto Sans KR';
            ctx.textAlign = 'center';
            ctx.fillText('포트폴리오가 비어있습니다', ctx.canvas.width / 2, ctx.canvas.height / 2);

            // 퍼센트 목록도 비우기
            const percentagesList = document.getElementById('portfolioPercentages');
            percentagesList.innerHTML = `<h3>종목별 보유 현황</h3><p class="empty-state">포트폴리오가 비어있습니다.</p>`;
            return;
        }

        const labels = Array.from(this.portfolio.keys());
        const data = Array.from(this.portfolio.values()).map(stock => 
            stock.totalQuantity * stock.currentPrice
        );
        const totalValue = data.reduce((sum, value) => sum + value, 0);

        // 종목별 퍼센트 목록 업데이트
        const percentagesList = document.getElementById('portfolioPercentages');
        percentagesList.innerHTML = '<h3>종목별 보유 현황</h3>';
        if (this.portfolio.size > 0) {
            this.portfolio.forEach((stock, stockName) => {
                const value = stock.totalQuantity * stock.currentPrice;
                const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : 0;
                const item = document.createElement('div');
                item.className = 'percentage-item';
                item.innerHTML = `<span>${stockName}</span><span>${percentage}%</span>`;
                percentagesList.appendChild(item);
            });
        } else {
            percentagesList.innerHTML += `<p class="empty-state">포트폴리오가 비어있습니다.</p>`;
        }

        const colors = [
            '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
            '#9b59b6', '#1abc9c', '#34495e', '#e67e22'
        ];
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                family: 'Noto Sans KR',
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.label}: ${value.toLocaleString()}달러 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    removeStock(stockName) {
        if (confirm(`'${stockName}' 종목을 포트폴리오에서 제거하시겠습니까?\n\n이 작업은 해당 종목의 모든 거래 내역도 함께 삭제됩니다.`)) {
            // 포트폴리오에서 종목 제거
            this.portfolio.delete(stockName);
            
            // 해당 종목의 모든 거래 내역 삭제
            this.transactions = this.transactions.filter(transaction => transaction.stockName !== stockName);
            
            this.saveToLocalStorage();
            this.updateDisplay();
        }
    }

    saveToLocalStorage() {
        const data = {
            portfolio: Array.from(this.portfolio.entries()),
            transactions: this.transactions,
            includeRealizedPnlInAvgCost: this.includeRealizedPnlInAvgCost
        };
        localStorage.setItem('stockCalculator', JSON.stringify(data));
    }

    loadFromLocalStorage() {
        const data = localStorage.getItem('stockCalculator');
        if (data) {
            try {
                const parsed = JSON.parse(data);
                this.portfolio = new Map(parsed.portfolio || []);
                this.transactions = parsed.transactions || [];
                this.includeRealizedPnlInAvgCost = parsed.includeRealizedPnlInAvgCost || false;
            } catch (e) {
                console.error('로컬 스토리지 데이터 로드 실패:', e);
            }
        }
    }

    // 포트폴리오 데이터를 JSON 파일로 저장
    savePortfolioToFile() {
        const data = {
            portfolio: Array.from(this.portfolio.entries()),
            transactions: this.transactions
        };
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `my_portfolio_${new Date().toISOString().slice(0, 10)}.json`; // 파일명 설정 (날짜 포함)
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('포트폴리오가 성공적으로 저장되었습니다!');
    }

    // JSON 파일에서 포트폴리오 데이터를 로드
    loadPortfolioFromFile(file) {
        if (!file) {
            alert('파일을 선택해주세요.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const loadedData = JSON.parse(event.target.result);
                
                // 포트폴리오 및 거래 내역 업데이트
                this.portfolio = new Map(loadedData.portfolio || []);
                this.transactions = loadedData.transactions || [];
                
                // 로컬 스토리지도 업데이트
                this.saveToLocalStorage();
                this.updateDisplay();

                alert('포트폴리오가 성공적으로 불러와졌습니다!');
            } catch (e) {
                console.error('포트폴리오 파일 로드 실패:', e);
                alert('유효하지 않은 포트폴리오 파일입니다.');
            }
        };
        reader.readAsText(file);
    }

    // 현재가 업데이트 기능
    updateCurrentPrice(stockName, newPrice) {
        if (this.portfolio.has(stockName)) {
            this.portfolio.get(stockName).currentPrice = newPrice;
            this.saveToLocalStorage();
            this.updateDisplay();
        }
    }

    // 수동으로 현재가 입력하는 기능
    showPriceInputModal(stockName) {
        const currentPrice = this.portfolio.get(stockName)?.currentPrice || 0;
        const newPrice = prompt(`${stockName}의 현재가를 입력하세요:`, currentPrice.toLocaleString());
        
        if (newPrice !== null && !isNaN(newPrice) && parseFloat(newPrice) >= 0) {
            this.updateCurrentPrice(stockName, parseFloat(newPrice));
        }
    }

    // 거래 내역 모달 표시
    showTransactionModal(stockName) {
        this.currentModalStock = stockName;
        const modal = document.getElementById('transactionModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalSummary = document.getElementById('modalSummary');
        const modalTransactions = document.getElementById('modalTransactions');
        
        // 모달 제목 설정
        modalTitle.textContent = `${stockName} 거래 내역`;
        
        // 해당 종목의 거래 내역 필터링
        const stockTransactions = this.transactions.filter(t => t.stockName === stockName);
        
        // 요약 정보 표시
        const stock = this.portfolio.get(stockName);
        if (stock) {
            const currentValue = stock.totalQuantity * stock.currentPrice;
            const profit = currentValue - stock.totalCost;
            const profitRate = stock.totalCost > 0 ? (profit / stock.totalCost * 100) : 0;
            
            modalSummary.innerHTML = `
                <h3>${stockName} 포트폴리오 요약</h3>
                <div class="summary-grid">
                    <div class="summary-item">
                        <strong>보유 수량</strong>
                        <span>${stock.totalQuantity.toLocaleString()}주</span>
                    </div>
                    <div class="summary-item">
                        <strong>평단가</strong>
                        <span>${stock.averagePrice.toLocaleString()}달러</span>
                    </div>
                    <div class="summary-item">
                        <strong>현재가</strong>
                        <span>${stock.currentPrice.toLocaleString()}달러</span>
                    </div>
                    <div class="summary-item">
                        <strong>총 투자금액</strong>
                        <span>${stock.totalCost.toLocaleString()}달러</span>
                    </div>
                    <div class="summary-item">
                        <strong>평가금액</strong>
                        <span>${currentValue.toLocaleString()}달러</span>
                    </div>
                    <div class="summary-item">
                        <strong>수익/손실</strong>
                        <span class="${profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                            ${profit >= 0 ? '+' : ''}${profit.toLocaleString()}달러
                        </span>
                    </div>
                    <div class="summary-item">
                        <strong>수익률</strong>
                        <span class="${profitRate >= 0 ? 'profit-positive' : 'profit-negative'}">
                            ${profitRate >= 0 ? '+' : ''}${profitRate.toFixed(2)}%
                        </span>
                    </div>
                </div>
            `;
        } 
        
        // 거래 내역 표시
        if (stockTransactions.length === 0) {
            modalTransactions.innerHTML = `
                <div class="empty-state">
                    <p>거래 내역이 없습니다.</p>
                </div>
            `;
        } else {
            modalTransactions.innerHTML = '';
            
            // 거래 내역을 날짜순으로 정렬 (최신순)
            stockTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            stockTransactions.forEach(transaction => {
                const transactionItem = document.createElement('div');
                transactionItem.className = 'transaction-item';
                
                const transactionDate = new Date(transaction.date);
                const formattedDate = transactionDate.toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const totalAmount = transaction.quantity * transaction.price;
                
                transactionItem.innerHTML = `
                    <div class="transaction-header">
                        <div class="transaction-info">
                            <span class="transaction-type ${transaction.type}">
                                ${transaction.type === 'buy' ? '매수' : '매도'}
                            </span>
                            <span class="transaction-date">${formattedDate}</span>
                        </div>
                        <button class="btn-danger btn-small" onclick="event.stopPropagation(); stockCalculator.removeTransaction(${transaction.id})">
                            삭제
                        </button>
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-detail">
                            <strong>수량</strong>
                            <span>${transaction.quantity.toLocaleString()}주</span>
                        </div>
                        <div class="transaction-detail">
                            <strong>단가</strong>
                            <span>${transaction.price.toLocaleString()}달러</span>
                        </div>
                        <div class="transaction-detail">
                            <strong>거래금액</strong>
                            <span>${totalAmount.toLocaleString()}달러</span>
                        </div>
                    </div>
                `;
                
                modalTransactions.appendChild(transactionItem);
            });
        }
        
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // 스크롤 방지
    }
    
    // 개별 거래 삭제
    removeTransaction(transactionId) {
        if (confirm('이 거래를 삭제하시겠습니까?\n\n삭제 후 포트폴리오가 재계산됩니다.')) {
            // 거래 내역에서 제거
            this.transactions = this.transactions.filter(t => t.id !== transactionId);
            
            // 포트폴리오 재계산
            this.recalculatePortfolio();
            
            this.saveToLocalStorage();
            this.updateDisplay();
            
            // 모달이 열려있다면 모달 내용도 업데이트
            if (this.currentModalStock) {
                this.showTransactionModal(this.currentModalStock);
            }
        }
    }
    
    // 포트폴리오 재계산
    recalculatePortfolio() {
        // 기존 currentPrice를 저장
        const savedCurrentPrices = new Map();
        this.portfolio.forEach((stock, stockName) => {
            savedCurrentPrices.set(stockName, stock.currentPrice);
        });

        // 포트폴리오 초기화
        this.portfolio.clear();
        
        // 모든 거래를 시간순으로 정렬하여 재계산
        const sortedTransactions = [...this.transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedTransactions.forEach(transaction => {
            this.updatePortfolio(transaction.stockName, transaction.quantity, transaction.price, transaction.type);
        });

        // 저장된 currentPrice를 다시 적용
        savedCurrentPrices.forEach((price, stockName) => {
            if (this.portfolio.has(stockName)) {
                this.portfolio.get(stockName).currentPrice = price;
            }
        });
    }

    // 모달 닫기
    closeModal() {
        const modal = document.getElementById('transactionModal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // 스크롤 복원
        this.currentModalStock = null;
    }

    // 포트폴리오 초기화
    clearPortfolio() {
        if (confirm('모든 포트폴리오 데이터를 삭제하시겠습니까?')) {
            this.portfolio.clear();
            this.transactions = [];
            this.saveToLocalStorage();
            this.updateDisplay();
        }
    }

    // 도움말 모달 열기
    openHelpModal() {
        const helpModal = document.getElementById('helpModal');
        const helpModalBody = document.getElementById('helpModalBody');
        helpModalBody.innerHTML = `
            <div style="text-align: left; white-space: pre-line; font-family: inherit; font-size: 1rem;">
                <h2>사용 설명서</h2>
                
                <h3>1. 거래 내역 추가</h3>
                <ul>
                    <li><b>종목명:</b> 주식의 이름을 입력합니다. (자동 완성 기능 제공)</li>
                    <li><b>수량:</b> 매수 또는 매도하는 주식의 수량을 입력합니다.</li>
                    <li><b>단가:</b> 주당 가격을 입력합니다.</li>
                    <li><b>거래 유형:</b> '매수' 또는 '매도'를 선택합니다.</li>
                    <li><b>거래 추가:</b> 입력된 정보로 거래를 추가합니다.</li>
                    <li><b>대량 거래 내역 추가:</b> 여러 거래를 텍스트 형식으로 한 번에 추가합니다.</li>
                </ul>

                <h3>2. 포트폴리오 현황</h3>
                <ul>
                    <li><b>총 보유 종목:</b> 현재 보유 중인 유니크한 종목의 수입니다.</li>
                    <li><b>총 투자금액:</b> 모든 종목에 대한 총 매수 금액입니다.</li>
                    <li><b>총 평가금액:</b> 현재가 기준으로 모든 보유 종목의 총 가치입니다.</li>
                    <li><b>수익률:</b> (총 평가금액 - 총 투자금액) / 총 투자금액 * 100% 입니다.</li>
                </ul>

                <h3>3. 보유 종목 상세</h3>
                <ul>
                    <li>각 종목별 보유 수량, 평단가, 현재가, 평가금액, 수익/손실, 수익률을 확인할 수 있습니다.</li>
                    <li><b>'실현 손익 포함하여 평단가 계산' 체크박스:</b> 활성화하면 매도 시 발생하는 실현 손익을 남은 주식의 평단가에 반영합니다. (체크 해제 시 기존 평단가 유지)</li>
                    <li>종목을 클릭하면 해당 종목의 상세 거래 내역을 모달로 볼 수 있습니다.</li>
                    <li><b>'현재가 입력' 버튼:</b> 종목의 현재가를 수동으로 업데이트할 수 있습니다.</li>
                    <li><b>'삭제' 버튼:</b> 해당 종목과 관련된 모든 거래 내역을 삭제합니다.</li>
                </ul>

                <h3>4. 포트폴리오 구성</h3>
                <ul>
                    <li>보유 종목의 포트폴리오 비중을 도넛 차트로 시각화하여 보여줍니다.</li>
                    <li><b>종목별 보유 현황:</b> 각 종목의 평가 금액 비중을 퍼센트로 표시합니다.</li>
                </ul>

                <h3>5. 데이터 관리</h3>
                <ul>
                    <li><b>포트폴리오 저장:</b> 현재 포트폴리오 데이터를 JSON 파일로 저장합니다.</li>
                    <li><b>포트폴리오 불러오기:</b> 이전에 저장한 JSON 파일로부터 포트폴리오 데이터를 불러옵니다.</li>                    
                </ul>
            </div>
        `;
        helpModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        // 닫기 버튼 이벤트 (중복 방지 위해 한 번만 등록)
        const closeBtn = document.getElementById('closeHelpModal');
        if (!closeBtn._helpModalBound) {
            closeBtn.addEventListener('click', () => {
                this.closeHelpModal();
            });
            closeBtn._helpModalBound = true;
        }
        // 바깥 클릭 시 닫기
        helpModal.onclick = (e) => {
            if (e.target === helpModal) {
                this.closeHelpModal();
            }
        };
    }

    // 도움말 모달 닫기
    closeHelpModal() {
        const helpModal = document.getElementById('helpModal');
        helpModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }

    _parseDateString(dateString) {
        // "MM.DD" 형식의 문자열을 받아 현재 연도를 붙여 Date 객체로 변환
        const currentYear = new Date().getFullYear();
        const [month, day] = dateString.split('.').map(Number);
        // 월은 0부터 시작하므로 1을 빼줍니다.
        return new Date(currentYear, month - 1, day);
    }

    parseAndAddTransactions(transactionText, stockName) {
        const lines = transactionText.split('\n').map(line => line.trim()).filter(line => line !== '');
        const transactionsToAdd = [];
        
        let currentDate = null;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // 날짜 파싱 (예: 8.19)
            const dateMatch = line.match(/^(\d{1,2}\.\d{1,2})$/);
            if (dateMatch) {
                currentDate = this._parseDateString(dateMatch[1]);
                continue;
            }
            
            // 거래 유형, 수량 파싱 (예: 판매 6주, 구매 8주)
            const quantityMatch = line.match(/(판매|구매)\s+(\d+)주/);
            if (quantityMatch) {
                const type = quantityMatch[1] === '구매' ? 'buy' : 'sell';
                const quantity = parseInt(quantityMatch[2]);
                
                // 다음 줄에서 가격 파싱 (예: 주당 $77.76)
                if (i + 1 < lines.length) {
                    const priceMatch = lines[i + 1].match(/주당\s+\$([\d\.]+)/);
                    if (priceMatch && currentDate) {
                        const price = parseFloat(priceMatch[1]);
                        transactionsToAdd.push({
                            stockName,
                            quantity,
                            price,
                            type,
                            date: currentDate.toISOString()
                        });
                        i++; // 가격 줄은 건너뛰기
                    }
                }
                continue;
            }
        }
        
        if (transactionsToAdd.length > 0) {
            // 가장 오래된 거래부터 처리하기 위해 배열을 역순으로 정렬
            transactionsToAdd.reverse().forEach(transaction => {
                this.addTransaction(transaction.stockName, transaction.quantity, transaction.price, transaction.type);
            });
            alert(`${transactionsToAdd.length}개의 거래 내역이 추가되었습니다.`);
        } else {
            alert('유효한 거래 내역을 찾을 수 없습니다. 형식을 확인해주세요.');
        }
    }

    showPnlCalculationExplanation() {
        // 모달을 좌측 정렬로 띄우기 위해 직접 모달에 내용 삽입
        const modal = document.getElementById('pnlExplanationModal');
        const modalBody = document.getElementById('pnlExplanationModalBody');
        modalBody.innerHTML = `
            <div style="text-align: left; white-space: pre-line; font-family: inherit; font-size: 1rem;">
평단가 계산 방식:

1. <b>실현 손익 포함 모드 (기본)</b>: 
   총 투자금액에서 매도 금액(실제 판매가)만큼 차감하여 남은 투자금액을 기준으로 평단가를 재계산합니다.
   이를 통해 매도 시 발생한 손익이 남은 주식의 평단가에 직접 반영됩니다. (본전 개념)

   <u>예시 (실현 손익 포함):</u>
   - 2주 매수, 주당 $200 (총 투자: $400, 평단가: $200)
   - 1주 매도, 주당 $100 (실제 매도금액: $100)
   - 남은 투자금액 = $400 - $100 (실제 매도금) = $300
   - 남은 평단가 = $300 / 1주 = $300

2. <b>실현 손익 미포함 모드</b>: 
   총 투자금액에서 매도한 수량의 기존 평단가에 해당하는 금액만큼 차감합니다.
   매도 시 발생한 손익은 별도의 실현 손익으로만 기록되며, 남아있는 주식의 평단가는 변경되지 않습니다.

   <u>예시 (실현 손익 미포함):</u>
   - 2주 매수, 주당 $200 (총 투자: $400, 평단가: $200)
   - 1주 매도, 주당 $100 (기존 평단가로 계산된 차감액: $200)
   - 남은 투자금액 = $400 - $200 (기존 평단가 기준) = $200
   - 남은 평단가 = $200 / 1주 = $200
            </div>
        `;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        // 닫기 버튼 이벤트 (중복 방지 위해 한 번만 등록)
        const closeBtn = document.getElementById('closePnlExplanationModal');
        if (!closeBtn._pnlModalBound) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
            closeBtn._pnlModalBound = true;
        }
        // 바깥 클릭 시 닫기
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        };
    }
}

// 전역 인스턴스 생성
const stockCalculator = new StockCalculator();

// 키보드 단축키
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        document.getElementById('transactionForm').dispatchEvent(new Event('submit'));
    }
});

// 페이지 로드 시 애니메이션
window.addEventListener('load', () => {
    document.querySelectorAll('.input-section, .portfolio-section, .stocks-section, .chart-section')
        .forEach((section, index) => {
            section.style.opacity = '0';
            section.style.transform = 'translateY(30px)';
            setTimeout(() => {
                section.style.transition = 'all 0.6s ease';
                section.style.opacity = '1';
                section.style.transform = 'translateY(0)';
            }, index * 200);
        });
});
