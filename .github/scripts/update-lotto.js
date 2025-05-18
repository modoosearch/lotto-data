const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
    
    // 5. 동행복권 API에서 데이터 가져오기
    const response = await axios.get(
      `https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${testRound}`
    );
    
    // 6. 데이터 확인
    if (response.data && response.data.returnValue === 'success') {
      console.log(`${testRound}회차 데이터를 찾았습니다!`);
      
      // 7. 필요한 데이터만 추출
      const newData = {
        round: parseInt(response.data.drwNo),
        numbers: [
          parseInt(response.data.drwtNo1),
          parseInt(response.data.drwtNo2),
          parseInt(response.data.drwtNo3),
          parseInt(response.data.drwtNo4),
          parseInt(response.data.drwtNo5),
          parseInt(response.data.drwtNo6)
        ].sort((a, b) => a - b),
        bonusNumber: parseInt(response.data.bnusNo),
        firstPrize: parseInt(response.data.firstWinamnt),
        firstWinners: parseInt(response.data.firstPrzwnerCo),
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
    } else {
      console.log(`${testRound}회차 데이터를 가져오지 못했습니다.`);
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
    return dateStr; // 오류 시 원본 반환
  }
}

// 스크립트 실행
main();
