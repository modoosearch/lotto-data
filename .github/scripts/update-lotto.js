const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');

// 데이터 파일 경로
const DATA_FILE = path.join(__dirname, '../../data/lotto-data.json');

// 메인 함수
async function main() {
  try {
    console.log('로또 데이터 업데이트 스크립트 시작...');
    
    // 1. 기존 데이터 읽기
    let lottoData = [];
    if (fs.existsSync(DATA_FILE)) {
      const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
      lottoData = JSON.parse(fileContent);
      console.log(`기존 데이터 ${lottoData.length}개를 읽었습니다.`);
    }
    
    // 2. 최신 회차 확인
    let latestRound = 0;
    if (lottoData.length > 0) {
      // 각 항목의 round 값을 출력하여 디버깅
      console.log('기존 데이터의 회차 번호 샘플:');
      for (let i = 0; i < Math.min(3, lottoData.length); i++) {
        console.log(`인덱스 ${i}: round=${lottoData[i].round}, 타입=${typeof lottoData[i].round}`);
      }
      
      // 모든 데이터의 round 값을 확인하여 최대값 찾기
      // 문자열인 경우 숫자로 변환
      const rounds = lottoData.map(item => {
        const round = typeof item.round === 'string' ? parseInt(item.round) : item.round;
        return isNaN(round) ? 0 : round;
      });
      latestRound = Math.max(...rounds);
      console.log(`기존 데이터의 최신 회차: ${latestRound}`);
    }
    
    // 3. 동행복권 웹사이트에서 최신 정보 가져오기
    console.log('동행복권 웹사이트에서 최신 정보를 가져오는 중...');
    const response = await axios.get('https://dhlottery.co.kr/gameResult.do?method=byWin', {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    // 4. 한글 인코딩 처리
    const html = iconv.decode(response.data, 'EUC-KR');
    const $ = cheerio.load(html);
    
    // 5. 현재 회차 정보 추출
    const winRoundText = $('.win_result h4').text().trim();
    console.log('추출된 회차 텍스트:', winRoundText);
    
    // 수정된 정규식 패턴: "제"가 없는 경우도 처리
    const roundMatch = winRoundText.match(/(\d+)회/);
    if (!roundMatch) {
      console.log('회차 정보를 찾을 수 없습니다. 기존 데이터를 유지합니다.');
      return;
    }
    
    const currentRound = parseInt(roundMatch[1]);
    console.log(`현재 웹사이트 회차: ${currentRound}`);
    
    // 6. 이미 최신 데이터가 있는 경우
    if (currentRound <= latestRound) {
      console.log('이미 최신 데이터가 있습니다. 기존 데이터를 유지합니다.');
      return;
    }
    
    // 7. 당첨 번호 추출
    const winNumbers = [];
    $('.win_result .nums .win .ball_645').each((i, el) => {
      winNumbers.push(parseInt($(el).text().trim()));
    });
    console.log('추출된 당첨 번호:', winNumbers);
    
    // 8. 보너스 번호 추출
    const bonusNumber = parseInt($('.win_result .nums .bonus .ball_645').text().trim());
    console.log('추출된 보너스 번호:', bonusNumber);
    
    // 9. 당첨금 정보 추출
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
    console.log('추출된 1등 당첨금:', firstPrize);
    console.log('추출된 1등 당첨자 수:', firstWinners);
    
    // 10. 추첨일 추출
    const drawDateText = $('.win_result p.desc').text().trim();
    console.log('추출된 추첨일 텍스트:', drawDateText);
    
    const dateMatch = drawDateText.match(/$$(.+)$$/);
    const drawDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }) + ' 추첨';
    console.log('추출된 추첨일:', drawDate);
    
    // 11. 새 데이터 생성
    const newData = {
      round: currentRound,
      numbers: winNumbers,
      bonusNumber: bonusNumber,
      firstPrize: firstPrize,
      firstWinners: firstWinners,
      drawDate: drawDate
    };
    
    console.log('새 데이터:', newData);
    
    // 12. 데이터 유효성 검사
    if (winNumbers.length !== 6 || !bonusNumber) {
      console.error('파싱된 데이터가 유효하지 않습니다. 기존 데이터를 유지합니다.');
      return;
    }
    
    // 13. 기존 데이터에서 중복 제거
    const existingIndex = lottoData.findIndex(item => {
      const itemRound = typeof item.round === 'string' ? parseInt(item.round) : item.round;
      return itemRound === currentRound;
    });
    
    if (existingIndex !== -1) {
      console.log(`${currentRound}회차 데이터가 이미 존재합니다. 제거 후 맨 앞에 추가합니다.`);
      lottoData.splice(existingIndex, 1);
    }
    
    // 14. 새 데이터를 배열의 맨 앞에 추가 (중요: unshift 사용)
    console.log(`${currentRound}회차 새 데이터를 배열의 맨 앞에 추가합니다.`);
    lottoData.unshift(newData);
    
    // 15. 회차 번호로 내림차순 정렬 (확실하게 처리)
    console.log('데이터를 내림차순으로 정렬합니다 (최신 회차가 맨 위)...');
    lottoData.sort((a, b) => {
      // 문자열을 숫자로 변환
      const roundA = typeof a.round === 'string' ? parseInt(a.round) : a.round;
      const roundB = typeof b.round === 'string' ? parseInt(b.round) : b.round;
      
      // 내림차순 정렬 (큰 숫자가 앞으로)
      return roundB - roundA;
    });
    
    // 16. 정렬 확인
    console.log('정렬 후 처음 3개 항목:');
    for (let i = 0; i < Math.min(3, lottoData.length); i++) {
      console.log(`인덱스 ${i}: round=${lottoData[i].round}`);
    }
    
    console.log('정렬 후 마지막 3개 항목:');
    for (let i = Math.max(0, lottoData.length - 3); i < lottoData.length; i++) {
      console.log(`인덱스 ${i}: round=${lottoData[i].round}`);
    }
    
    // 17. 데이터 저장 전 확인
    if (lottoData.length > 0) {
      const firstItem = lottoData[0];
      const firstRound = typeof firstItem.round === 'string' ? parseInt(firstItem.round) : firstItem.round;
      
      if (firstRound !== currentRound) {
        console.error(`오류: 정렬 후 첫 번째 항목이 최신 회차(${currentRound})가 아닙니다. 강제로 순서를 조정합니다.`);
        
        // 강제로 최신 데이터를 맨 앞으로 이동
        const newDataIndex = lottoData.findIndex(item => {
          const itemRound = typeof item.round === 'string' ? parseInt(item.round) : item.round;
          return itemRound === currentRound;
        });
        
        if (newDataIndex !== -1) {
          const newDataItem = lottoData.splice(newDataIndex, 1)[0];
          lottoData.unshift(newDataItem);
        }
      }
    }
    
    // 18. 데이터 저장
    const jsonData = JSON.stringify(lottoData, null, 2);
    fs.writeFileSync(DATA_FILE, jsonData);
    console.log(`${lottoData.length}개의 데이터가 저장되었습니다.`);
    
    // 19. 저장된 데이터 확인
    console.log('저장된 JSON의 처음 부분:');
    const savedJson = jsonData.substring(0, 500) + '...';
    console.log(savedJson);
    
    console.log('로또 데이터 업데이트 완료!');
  } catch (error) {
    console.error('스크립트 실행 오류:', error);
    // 오류가 발생해도 기존 데이터는 유지됨
  }
}

// 스크립트 실행
main();
