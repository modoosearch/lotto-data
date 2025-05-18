const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function updateLottoData() {
  try {
    // 1. 기존 JSON 파일 읽기
    const dataPath = path.join(__dirname, '../../data/lotto-data.json');
    const lottoData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 2. 최신 회차 번호 확인
    const latestRound = Math.max(...lottoData.map(item => item.round));
    console.log(`현재 최신 회차: ${latestRound}`);
    
    // 3. 다음 회차 데이터 가져오기
    const nextRound = latestRound + 1;
    console.log(`다음 회차 확인 중: ${nextRound}`);
    
    const response = await axios.get(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${nextRound}`
    );
    
    // 4. 새 데이터가 있는지 확인
    if (response.data && response.data.returnValue === 'success') {
      console.log(`${nextRound}회차 데이터를 찾았습니다!`);
      
      // 5. 새 데이터 형식 변환
      const newData = {
        round: response.data.drwNo,
        numbers: [
          response.data.drwtNo1,
          response.data.drwtNo2,
          response.data.drwtNo3,
          response.data.drwtNo4,
          response.data.drwtNo5,
          response.data.drwtNo6
        ].sort((a, b) => a - b),
        bonusNumber: response.data.bnusNo,
        firstPrize: response.data.firstWinamnt,
        firstWinners: response.data.firstPrzwnerCo,
        // 2등 당첨금은 API에서 제공하지 않아 계산 (실제 데이터와 다를 수 있음)
        secondPrize: Math.floor(response.data.firstWinamnt / 10),
        secondWinners: 0, // 실제 데이터 필요
        drawDate: formatDate(response.data.drwNoDate)
      };
      
      // 6. 데이터 추가
      lottoData.push(newData);
      
      // 7. 회차 기준 내림차순 정렬
      lottoData.sort((a, b) => b.round - a.round);
      
      // 8. 파일에 저장
      fs.writeFileSync(dataPath, JSON.stringify(lottoData, null, 2));
      console.log(`${nextRound}회차 데이터가 성공적으로 추가되었습니다.`);
    } else {
      console.log(`${nextRound}회차 데이터가 아직 없습니다.`);
    }
  } catch (error) {
    console.error('로또 데이터 업데이트 중 오류 발생:', error);
  }
}

// 날짜 형식 변환 (YYYY-MM-DD -> YYYY년 MM월 DD일)
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}년 ${month}월 ${day}일`;
}

// 스크립트 실행
updateLottoData();
