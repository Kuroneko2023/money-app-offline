import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Dimensions } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { PieChart } from "react-native-chart-kit";

// สีประจำหมวดหมู่ (EVA-01 COLOR PALETTE)
const categoryColors: any = {
  '🍽️ อาหาร (RATION)': '#FF4A3D',
  '🚗 เดินทาง (UNIT-MOVE)': '#00D0FF',
  'ช้อปปิ้ง (ARMOR)': '#E040FB',
  'บิล/ค่าเช่า (MAINTENANCE)': '#FFEA00',
  'บันเทิง (ENTERTAIN)': '#FF4081',
  'สุขภาพ (REPAIR)': '#00E676',
  'อื่นๆ (OTHER)': '#6A4C9C',
  '💰 เงินเดือน (SALARY)': '#75F94C',
  'โบนัส (BONUS)': '#1DE9B6',
  'รายได้เสริม (SUPPORT)': '#B2FF59',
};

const screenWidth = Dimensions.get("window").width;

const chartConfig = {
  backgroundGradientFrom: "#1E2923",
  backgroundGradientFromOpacity: 0,
  backgroundGradientTo: "#08130D",
  backgroundGradientToOpacity: 0.5,
  color: (opacity = 1) => `rgba(26, 255, 146, ${opacity})`,
  strokeWidth: 2, 
  barPercentage: 0.5,
  useShadowColorFromDataset: false 
};

export default function DashboardScreen() {
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('monthly');
  const [monthOffset, setMonthOffset] = useState(0);
  
  const [data, setData] = useState<any[]>([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [currentDisplayDate, setCurrentDisplayDate] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, [timeFilter, monthOffset]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let startDateStr = '';
      let endDateStr = '';
      let displayDateText = '';

      if (timeFilter === 'daily') {
        const start = new Date(now.setHours(0, 0, 0, 0));
        const end = new Date(now.setHours(23, 59, 59, 999));
        startDateStr = start.toISOString();
        endDateStr = end.toISOString();
        displayDateText = 'TODAY';
      } 
      else if (timeFilter === 'weekly') {
        const day = now.getDay();
        const diff = now.getDate() - day;
        const start = new Date(now.setDate(diff));
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        startDateStr = start.toISOString();
        endDateStr = end.toISOString();
        displayDateText = 'THIS WEEK';
      } 
      else if (timeFilter === 'monthly') {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const start = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
        const end = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
        startDateStr = start.toISOString();
        endDateStr = end.toISOString();
        const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        displayDateText = `${monthNames[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
      }
      else if (timeFilter === 'all') {
        startDateStr = new Date('2000-01-01').toISOString();
        endDateStr = new Date('2100-01-01').toISOString();
        displayDateText = 'ALL TIME RECORD';
      }

      setCurrentDisplayDate(displayDateText);

      const database = await SQLite.openDatabaseAsync('my_wallet_eva.db');
      // ดึงข้อมูลทั้งหมดในช่วงเวลาที่เลือก โดยไม่สนใจว่าเป็นรายรับหรือรายจ่าย
      const query = `SELECT * FROM transactions WHERE transaction_date >= ? AND transaction_date <= ?`;
      const rows: any = await database.getAllAsync(query, [startDateStr, endDateStr]);
      
      let sumInc = 0;
      let sumExp = 0;
      let totalVolume = 0; // ยอดการเคลื่อนไหวทั้งหมดเพื่อนำไปคิด %
      const groupedData: any = {};
      
      rows.forEach((item: any) => {
        if (item.type === 'income') {
            sumInc += item.amount;
        } else {
            sumExp += item.amount;
        }
        
        totalVolume += item.amount;

        if (groupedData[item.category]) {
          groupedData[item.category] += item.amount;
        } else {
          groupedData[item.category] = item.amount;
        }
      });

      const chartData = Object.keys(groupedData).map((key) => ({
        name: key,
        amount: groupedData[key],
        color: categoryColors[key] || '#9CA3AF',
        percentage: totalVolume > 0 ? (groupedData[key] / totalVolume) * 100 : 0
      }));

      chartData.sort((a, b) => b.amount - a.amount);

      setData(chartData);
      setTotalIncome(sumInc);
      setTotalExpense(sumExp);

    } catch (error) {
      console.error("MAGI ANALYSIS ERROR:", error);
    }
    setLoading(false);
  };

  const netBalance = totalIncome - totalExpense;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ส่วนหัว */}
      <View style={styles.header}>
        <Text style={styles.title}>MAGI SYSTEM : สรุป</Text>
      </View>

      {/* แถบตัวกรองเวลา */}
      <View style={styles.timeFilterContainer}>
        <TouchableOpacity style={[styles.timeBtn, timeFilter === 'daily' && styles.timeBtnActive]} onPress={() => { setTimeFilter('daily'); setMonthOffset(0); }}>
          <Text style={[styles.timeBtnText, timeFilter === 'daily' && styles.timeBtnTextActive]}>DAY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.timeBtn, timeFilter === 'weekly' && styles.timeBtnActive]} onPress={() => { setTimeFilter('weekly'); setMonthOffset(0); }}>
          <Text style={[styles.timeBtnText, timeFilter === 'weekly' && styles.timeBtnTextActive]}>WEEK</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.timeBtn, timeFilter === 'monthly' && styles.timeBtnActive]} onPress={() => { setTimeFilter('monthly'); setMonthOffset(0); }}>
          <Text style={[styles.timeBtnText, timeFilter === 'monthly' && styles.timeBtnTextActive]}>MONTH</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.timeBtn, timeFilter === 'all' && styles.timeBtnActive]} onPress={() => { setTimeFilter('all'); setMonthOffset(0); }}>
          <Text style={[styles.timeBtnText, timeFilter === 'all' && styles.timeBtnTextActive]}>ALL</Text>
        </TouchableOpacity>
      </View>

      {/* ระบบเลื่อนเดือน */}
      {timeFilter === 'monthly' && (
        <View style={styles.monthNavContainer}>
          <TouchableOpacity onPress={() => setMonthOffset(prev => prev - 1)} style={styles.monthNavBtn}>
            <Text style={styles.monthNavText}>◀ PREV</Text>
          </TouchableOpacity>
          <Text style={styles.monthCurrentText}>{currentDisplayDate}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(prev => prev + 1)} style={styles.monthNavBtn}>
            <Text style={styles.monthNavText}>NEXT ▶</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* กล่องสรุปยอดรวม (รับ-จ่าย ในกล่องเดียว) */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>NET BALANCE ({timeFilter !== 'monthly' ? currentDisplayDate : 'MONTHLY'})</Text>
        {/* สีตัวเลขเปลี่ยนตามยอดคงเหลือ บวกรวย=เขียว ลบจน=แดง */}
        <Text style={[styles.balanceValue, { color: netBalance >= 0 ? '#75F94C' : '#FF4A3D' }]}>
          {netBalance >= 0 ? '+' : ''} ฿ {netBalance.toLocaleString()}
        </Text>
        
        <View style={styles.flowRow}>
          <View style={styles.flowBox}>
            <Text style={styles.flowLabel}>INCOME</Text>
            <Text style={styles.flowIncome}>+ ฿{totalIncome.toLocaleString()}</Text>
          </View>
          <View style={styles.flowBox}>
            <Text style={styles.flowLabel}>EXPENSE</Text>
            <Text style={styles.flowExpense}>- ฿{totalExpense.toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* เนื้อหาหลัก (กราฟวงกลมรวม + รายการ) */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#75F94C" style={{ marginTop: 50 }} />
        ) : data.length === 0 ? (
          <Text style={styles.emptyText}>NO DATA IN MAGI ARCHIVE</Text>
        ) : (
          <>
            <View style={styles.chartContainer}>
              <PieChart
                data={data.map(item => ({...item, legendFontColor: "#FFFFFF", legendFontSize: 10}))}
                width={screenWidth}
                height={220}
                chartConfig={chartConfig}
                accessor={"amount"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </View>

            <Text style={styles.sectionTitle}>ALL TRANSACTIONS BREAKDOWN</Text>
            {data.map((item, index) => (
              <View key={index} style={styles.itemRow}>
                <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                <View style={styles.itemInfo}>
                  <Text style={styles.categoryName}>{item.name}</Text>
                  <Text style={styles.categoryPercentage}>{item.percentage.toFixed(1)}%</Text>
                </View>
                <Text style={styles.categoryAmount}>฿{item.amount.toLocaleString()}</Text>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 50 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0616' },
  header: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, backgroundColor: '#241244', borderBottomWidth: 2, borderColor: '#75F94C', alignItems: 'center' },
  title: { color: '#B49CE5', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
  
  timeFilterContainer: { flexDirection: 'row', marginHorizontal: 20, marginTop: 20, marginBottom: 15, justifyContent: 'space-between' },
  timeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: '#180C2E', borderWidth: 1, borderColor: '#4A2A85', marginHorizontal: 2, borderRadius: 6 },
  timeBtnActive: { backgroundColor: '#4A2A85', borderColor: '#B49CE5' },
  timeBtnText: { color: '#6A4C9C', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  timeBtnTextActive: { color: '#E0D4F5', fontWeight: '900' },

  monthNavContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#180C2E', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#4A2A85' },
  monthNavBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  monthNavText: { color: '#75F94C', fontWeight: 'bold', fontSize: 12 },
  monthCurrentText: { color: '#FFFFFF', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  // สไตล์กล่องสรุปยอดแบบใหม่ (รวมมิตร)
  summaryCard: { backgroundColor: '#180C2E', marginHorizontal: 20, marginBottom: 20, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#6A4C9C', alignItems: 'center', elevation: 5, shadowColor: '#75F94C' },
  summaryTitle: { color: '#B49CE5', fontSize: 12, fontWeight: 'bold', letterSpacing: 1.5, marginBottom: 10 },
  balanceValue: { fontSize: 36, fontWeight: '900', marginBottom: 20, textShadowOffset: {width: 0, height: 0}, textShadowRadius: 10 },
  flowRow: { flexDirection: 'row', width: '100%', borderTopWidth: 1, borderTopColor: '#331D60', paddingTop: 15 },
  flowBox: { flex: 1, alignItems: 'center' },
  flowLabel: { color: '#6A4C9C', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 5 },
  flowIncome: { color: '#75F94C', fontSize: 16, fontWeight: 'bold' },
  flowExpense: { color: '#FF4A3D', fontSize: 16, fontWeight: 'bold' },
  
  content: { paddingHorizontal: 20 },
  chartContainer: { alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
  
  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#75F94C', marginTop: 10, marginBottom: 15, letterSpacing: 1, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#180C2E', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#331D60', borderLeftWidth: 4, borderLeftColor: '#6A4C9C' },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 15 },
  itemInfo: { flex: 1 },
  categoryName: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 },
  categoryPercentage: { color: '#B49CE5', fontSize: 10, marginTop: 2 },
  categoryAmount: { color: '#FFFFFF', fontWeight: '900', fontSize: 15 },
  
  emptyText: { textAlign: 'center', color: '#6A4C9C', marginTop: 40, fontWeight: 'bold', letterSpacing: 1.5 }
});