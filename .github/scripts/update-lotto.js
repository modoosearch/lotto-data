const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function updateLottoData() {
  try {
    console.log('스크립트 실행 시작...');
    
    // 1. 기존 JSON 파일 경로
    const dataPath = path.join(__dirname, '../../data/lotto-data.json');
    console.log('데이터 파일 경로:', dataPath);
    
    // 2. 데이터 디렉토리 확인 및 생성
    const dataDir = path.dirname(dataPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('데이터 디렉토리 생성됨:', dataDir);
    }
    
    // 3. 기존 JSON 파일 읽기 (없으면 빈 배열 생성)
    let lottoData = [];
    if (fs.existsSync(dataPath)) {
      try {
        const fileContent = fs.readFileSync(dataPath, 'utf8');
        console.log('파일 내용:', fileContent);
        
        if (fileContent.trim()) {
          lottoData = JSON.parse(fileContent);
          console.log('데이터 파일 읽기 성공. 항목 수:', lottoData.length);
        } else {
          console.log('파일이 비어 있습니다. 빈 배열로 시작합니다.');
        }
      } catch (readError) {
        console.error('파일 읽기/파싱 오류:', readError);
        console.log('빈 배열로 시작합니다.');
      }
    } else {
      console.log('데이터 파일이 없습니다. 새 파일을 생성합니다.');
    }
    
    // 4. 테스트를 위해 1172회 데이터 가져오기
    const testRound = 1172;
    console.log(`테스트: ${testRound}회차 데이터 가져오기 시도...`);
    
    // 5. 동행복권 API에서 데이터 가져오기
    try {
      const response = await axios.get(
        `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${testRound}`
      );
      
      console.log('API 응답:', JSON.stringify(response.data));
      
      // 6. 데이터 확인
      if (response.data && response.data.returnValue === 'success') {
        console.log(`${testRound}회차 데이터를 찾았습니다!`);
        
        // 7. 데이터 형식 변환
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
          secondPrize: Math.floor(response.data.firstWinamnt / 10), // 임의 계산
          secondWinners: Math.floor(Math.random() * 50) + 10, // 임의 값
          drawDate: formatDate(response.data.drwNoDate)
        };
        
        // 8. 기존 데이터에서 1172회 제거 (있는 경우)
        lottoData = lottoData.filter(item => item.round !== testRound);
        
        // 9. 새 데이터 추가
        lottoData.push(newData);
        
        // 10. 회차 기준 내림차순 정렬
        lottoData.sort((a, b) => b.round - a.round);
        
        // 11. 파일에 저장
        fs.writeFileSync(dataPath, JSON.stringify(lottoData, null, 2));
        console.log(`${testRound}회차 데이터가 성공적으로 추가되었습니다.`);
        console.log('저장된 데이터:', JSON.stringify(newData, null, 2));
      } else {
        console.log(`${testRound}회차 데이터를 가져오지 못했습니다.`);
      }
    } catch (apiError) {
      console.error('API 요청 오류:', apiError);
    }
  } catch (error) {
    console.error('로또 데이터 업데이트 중 오류 발생:', error);
    process.exit(1);
  }
}

// 날짜 형식 변환 (YYYY-MM-DD -> YYYY년 MM월 DD일)
function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}년 ${month}월 ${day}일`;
  } catch (error) {
    console.error('날짜 변환 오류:', error);
    return dateStr; // 오류 시 원본 반환
  }
}

// 스크립트 실행
updateLottoData();
