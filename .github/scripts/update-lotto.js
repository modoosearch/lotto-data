const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

// 메인 함수
async function main() {
  try {
    console.log('스크립트 실행 시작...');
    
    // 1. 데이터 디렉토리 확인 및 생성
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('데이터 디렉토리 생성됨:', dataDir);
    }
    
    // 2. 데이터 파일 경로
    const dataPath = path.join(dataDir, 'lotto-data.json');
    console.log('데이터 파일 경로:', dataPath);
    
    // 3. 데이터 파일 읽기 또는 생성
    let lottoData = [];
    if (fs.existsSync(dataPath)) {
      try {
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        if (fileContent.trim()) {
          lottoData = JSON.parse(fileContent);
          console.log('데이터 파일 읽기 성공. 항목 수:', lottoData.length);
        } else {
          console.log('파일이 비어 있습니다. 빈 배열로 초기화합니다.');
          fs.writeFileSync(dataPath, '[]');
        }
      } catch (readError) {
        console.log('빈 배열로 초기화합니다.');
        fs.writeFileSync(dataPath, '[]');
      }
    } else {
      console.log('데이터 파일이 없습니다. 새 파일을 생성합니다.');
      fs.writeFileSync(dataPath, '[]');
    }
    
    // 4. 테스트를 위해 1172회차 데이터 직접 가져오기
    const testRound = 1172;
    console.log(`테스트: ${testRound}회차 데이터 가져오기 시도...`);
    
    // 5. 동행복권 웹사이트에서 데이터 가져오기
    const response = await axios.get(
      `https://www.dhlottery.co.kr/gameResult.do?method=byWin&drwNo=${testRound}`
    );
    
    // 6. HTML 파싱
    const $ = cheerio.load(response.data);
    
    // 7. 회차 정보 추출
    const roundText = $('.win_result h4 strong').text().trim();
    const round = parseInt(roundText.replace(/[^0-9]/g, ''));
    console.log('회차:', round);
    
    // 8. 추첨일 추출
    const drawDateText = $('.win_result p.desc').text().trim();
    const drawDate = drawDateText.replace(/[$$$$]/g, '');
    console.log('추첨일:', drawDate);
    
    // 9. 당첨번호 추출
    const winNumbers = [];
    $('.win_result .num.win p span').each((index, element) => {
      const number = parseInt($(element).text().trim());
      winNumbers.push(number);
    });
    console.log('당첨번호:', winNumbers);
    
    // 10. 보너스 번호 추출
    const bonusNumber = parseInt($('.win_result .num.bonus p span').text().trim());
    console.log('보너스번호:', bonusNumber);
    
    // 11. 1등 당첨자 수 추출 (제공된 셀렉터 사용)
    const firstWinnersText = $('table.tbl_data tbody tr:nth-child(1) td:nth-child(3)').text().trim();
    const firstWinners = parseInt(firstWinnersText.replace(/[^0-9]/g, ''));
    console.log('1등 당첨자 수:', firstWinners);
    
    // 12. 1인당 당첨금액 추출 (제공된 셀렉터 사용)
    const firstPrizeText = $('table.tbl_data tbody tr:nth-child(1) td:nth-child(4)').text().trim();
    const firstPrize = parseInt(firstPrizeText.replace(/[^0-9]/g, ''));
    console.log('1인당 당첨금액:', firstPrize);
    
    // 13. 데이터 객체 생성
    const newData = {
      round,
      numbers: winNumbers,
      bonusNumber,
      firstPrize,
      firstWinners,
      drawDate
    };
    
    console.log('파싱된 데이터:', newData);
    
    // 14. 기존 데이터에서 같은 회차 제거 (있는 경우)
    lottoData = lottoData.filter(item => item.round !== round);
    
    // 15. 새 데이터 추가
    lottoData.push(newData);
    
    // 16. 회차 기준 내림차순 정렬
    lottoData.sort((a, b) => b.round - a.round);
    
    // 17. 파일에 저장
    fs.writeFileSync(dataPath, JSON.stringify(lottoData, null, 2));
    console.log(`${round}회차 데이터가 성공적으로 추가되었습니다.`);
  } catch (error) {
    console.error('로또 데이터 업데이트 중 오류 발생:', error);
    console.error('오류 세부 정보:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
    }
    process.exit(1);
  }
}

// 스크립트 실행
main();
