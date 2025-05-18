const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, '../../data/lotto-data.json');
const BACKUP_DIR = path.join(__dirname, '../../data/backups');

// 백업 생성 함수
function createBackup() {
  // 백업 디렉토리 생성
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  // 기존 파일이 있는 경우 백업
  if (fs.existsSync(DATA_FILE)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(BACKUP_DIR, `lotto-data-${timestamp}.json`);
    fs.copyFileSync(DATA_FILE, backupFile);
    console.log(`백업 파일 생성: ${backupFile}`);
    return backupFile;
  }
  return null;
}

// 기존 데이터 읽기 함수
function readExistingData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
      const data = JSON.parse(fileContent);
      console.log(`기존 데이터 ${data.length}개를 읽었습니다.`);
      return data;
    }
  } catch (error) {
    console.error('기존 데이터 읽기 오류:', error);
  }
  console.log('기존 데이터가 없거나 읽을 수 없습니다. 새 데이터 배열을 생성합니다.');
  return [];
}

// 동행복권 웹사이트에서 최신 로또 정보 가져오기
async function fetchLatestLottoData() {
  try {
    // 동행복권 웹사이트에서 최신 정보 가져오기
    console.log('동행복권 웹사이트에서 최신 정보를 가져오는 중...');
    const response = await axios.get('https://dhlottery.co.kr/gameResult.do?method=byWin', {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // 한글 인코딩 처리
    const html = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(html);
    
    // 현재 회차 정보 추출
    const winRoundText = $('.win_result h4').text().trim();
    const roundMatch = winRoundText.match(/제(\d+)회/);
    
    if (!roundMatch) {
      console.log('회차 정보를 찾을 수 없습니다.');
      return null;
    }
    
    const currentRound = parseInt(roundMatch[1]);
    console.log(`현재 웹사이트 회차: ${currentRound}`);
    
    // 당첨 번호 추출
    const winNumbers = [];
    $('.win_result .nums .win .ball_645').each((i, el) => {
      winNumbers.push(parseInt($(el).text().trim()));
    });
    
    // 보너스 번호 추출
    const bonusNumber = parseInt($('.win_result .nums .bonus .ball_645').text().trim());
    
    // 당첨금 정보 추출
    let firstPrize = 0;
    let firstWinners = 0;
    
    $('.tbl_data tbody tr').each((i, el) => {
      const rank = $(el).find('td:nth-child(1)').text().trim();
      if (rank === '1등') {
        const prizeText = $(el).find('td:nth-child(4)').text().trim();
        const winnerText = $(el).find('td:nth-child(3)').text().trim();
        
        // 금액에서 쉼표 제거하고 숫자로 변환
        firstPrize = parseInt(prizeText.replace(/[^\d]/g, ''));
        firstWinners = parseInt(winnerText.replace(/[^\d]/g, ''));
      }
    });
    
    // 추첨일 추출
    const drawDateText = $('.win_result p.desc').text().trim();
    const dateMatch = drawDateText.match(/$$(.+)$$/);
    const drawDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' 추첨';
    
    // 새 데이터 생성
    const newData = {
      round: currentRound,
      numbers: winNumbers,
      bonusNumber: bonusNumber,
      firstPrize: firstPrize,
      firstWinners: firstWinners,
      drawDate: drawDate
    };
    
    console.log('파싱된 데이터:', newData);
    
    // 데이터 유효성 검사
    if (winNumbers.length !== 6 || !bonusNumber) {
      console.error('파싱된 데이터가 유효하지 않습니다.');
      return null;
    }
    
    return newData;
  } catch (error) {
    console.error('데이터 가져오기 오류:', error);
    return null;
  }
}

// 특정 회차 데이터 가져오기 (복구용)
async function fetchLottoDataByRound(round) {
  try {
    console.log(`${round}회차 데이터를 가져오는 중...`);
    const response = await axios.get(`https://dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${round}`, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // 한글 인코딩 처리
    const html = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(html);
    
    // 회차 정보 확인
    const winRoundText = $('.win_result h4').text().trim();
    const roundMatch = winRoundText.match(/제(\d+)회/);
    
    if (!roundMatch || parseInt(roundMatch[1]) !== round) {
      console.log(`${round}회차 정보를 찾을 수 없습니다.`);
      return null;
    }
    
    // 당첨 번호 추출
    const winNumbers = [];
    $('.win_result .nums .win .ball_645').each((i, el) => {
      winNumbers.push(parseInt($(el).text().trim()));
    });
    
    // 보너스 번호 추출
    const bonusNumber = parseInt($('.win_result .nums .bonus .ball_645').text().trim());
    
    // 당첨금 정보 추출
    let firstPrize = 0;
    let firstWinners = 0;
    
    $('.tbl_data tbody tr').each((i, el) => {
      const rank = $(el).find('td:nth-child(1)').text().trim();
      if (rank === '1등') {
        const prizeText = $(el).find('td:nth-child(4)').text().trim();
        const winnerText = $(el).find('td:nth-child(3)').text().trim();
        
        // 금액에서 쉼표 제거하고 숫자로 변환
        firstPrize = parseInt(prizeText.replace(/[^\d]/g, ''));
        firstWinners = parseInt(winnerText.replace(/[^\d]/g, ''));
      }
    });
    
    // 추첨일 추출
    const drawDateText = $('.win_result p.desc').text().trim();
    const dateMatch = drawDateText.match(/$$(.+)$$/);
    const drawDate = dateMatch ? dateMatch[1] : `(${round}회차 추첨)`;
    
    // 데이터 생성
    const data = {
      round: round,
      numbers: winNumbers,
      bonusNumber: bonusNumber,
      firstPrize: firstPrize,
      firstWinners: firstWinners,
      drawDate: drawDate
    };
    
    // 데이터 유효성 검사
    if (winNumbers.length !== 6 || !bonusNumber) {
      console.error(`${round}회차 파싱된 데이터가 유효하지 않습니다.`);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error(`${round}회차 데이터 가져오기 오류:`, error);
    return null;
  }
}

// 메인 함수
async function main() {
  try {
    console.log('로또 데이터 업데이트 스크립트 시작...');
    
    // 데이터 디렉토리 확인 및 생성
    const dataDir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log(`데이터 디렉토리 생성: ${dataDir}`);
    }
    
    // 백업 생성
    const backupFile = createBackup();
    
    // 기존 데이터 읽기
    let lottoData = readExistingData();
    
    // 최신 회차 번호 확인
    let latestRound = 0;
    if (lottoData.length > 0) {
      // 회차 번호로 내림차순 정렬
      lottoData.sort((a, b) => b.round - a.round);
      latestRound = lottoData[0].round;
      console.log(`기존 데이터의 최신 회차: ${latestRound}`);
    }
    
    // 최신 데이터 가져오기
    const newData = await fetchLatestLottoData();
    
    if (newData) {
      // 이미 존재하는 회차인지 확인
      const existingIndex = lottoData.findIndex(item => item.round === newData.round);
      
      if (existingIndex !== -1) {
        console.log(`${newData.round}회차 데이터가 이미 존재합니다. 업데이트합니다.`);
        lottoData[existingIndex] = newData;
      } else {
        console.log(`${newData.round}회차 새 데이터를 추가합니다.`);
        lottoData.push(newData);
      }
      
      // 데이터가 1개만 있고 최신 회차가 아닌 경우 (데이터 손실 가능성)
      if (lottoData.length === 1 && newData.round < 1172) {
        console.log('데이터 손실이 감지되었습니다. 복구를 시도합니다...');
        
        // 최신 회차부터 1회차까지 데이터 복구 시도
        const startRound = Math.max(1, newData.round - 10); // 최대 10회차만 복구 시도 (전체 복구는 시간이 오래 걸림)
        const endRound = newData.round;
        
        console.log(`${startRound}회차부터 ${endRound}회차까지 데이터 복구를 시도합니다.`);
        
        for (let round = endRound; round >= startRound; round--) {
          if (round === newData.round) continue; // 이미 가져온 데이터는 건너뜀
          
          const roundData = await fetchLottoDataByRound(round);
          if (roundData) {
            lottoData.push(roundData);
            console.log(`${round}회차 데이터를 복구했습니다.`);
          }
          
          // API 요청 간격 (초당 1회 제한)
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    } else {
      console.log('새 데이터를 가져오지 못했습니다. 기존 데이터를 유지합니다.');
    }
    
    // 회차 번호로 내림차순 정렬
    lottoData.sort((a, b) => b.round - a.round);
    
    // 데이터 저장
    fs.writeFileSync(DATA_FILE, JSON.stringify(lottoData, null, 2));
    console.log(`${lottoData.length}개의 데이터가 저장되었습니다.`);
    
    // 백업 파일과 비교하여 데이터 손실 확인
    if (backupFile) {
      try {
        const backupContent = fs.readFileSync(backupFile, 'utf8');
        const backupData = JSON.parse(backupContent);
        
        if (backupData.length > lottoData.length + 5) { // 5개 이상 차이나면 경고
          console.warn(`경고: 백업 데이터(${backupData.length}개)보다 현재 데이터(${lottoData.length}개)가 적습니다!`);
          console.warn('데이터 손실이 발생했을 수 있습니다. 백업 파일을 확인하세요.');
        }
      } catch (error) {
        console.error('백업 파일 비교 중 오류:', error);
      }
    }
    
    console.log('로또 데이터 업데이트 완료!');
  } catch (error) {
    console.error('스크립트 실행 오류:', error);
    process.exit(1);
  }
}

// 스크립트 실행
main();
