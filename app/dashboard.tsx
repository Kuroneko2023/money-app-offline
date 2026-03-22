import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Dimensions } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { PieChart } from "react-native-chart-kit";

// สีประจำหมวดหมู่ (EVA-01 COLOR PALETTE)
const categoryColors: any = {
  // รายจ่าย
  '🍽️ อาหาร': '#FF4A3D',       // แดงส้ม Core
  '🚗 เดินทาง': '#00D0FF',      // ฟ้าพลังงาน
  '🛍️ ช้อปปิ้ง': '#E040FB',     // ม่วงนีออน
  '📄 บิล/ค่าเช่า': '#FFEA00',   // เหลืองเตือนภัย
  '🍿 บันเทิง': '#FF4081',      // ชมพูสะท้อนแสง
  '🏥 สุขภาพ': '#00E676',      // เขียวฟื้นฟู
  '📦 อื่นๆ': '#6A4C9C',        // ม่วงหม่น
  // รายรับ
  '💰 เงินเดือน': '#75F94C',     // เขียว EVA หลัก
  '🎁 โบนัส': '#1DE9B6',       // เขียวมินต์
  '📈 รายได้เสริม': '#B2FF59',   // เขียวตองอ่อน
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

  useEffect(() => { fetchDashboardData(); }, [timeFilter, monthOffset]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let start = '', end = '', label = '';

      if (timeFilter === 'daily') {
        const d = new Date(now.setHours(0,0,0,0));
        start = d.toISOString();
        end = new Date(now.setHours(23,59,59,999)).toISOString();
        label = 'วันนี้';
      } else if (timeFilter === 'monthly') {
        const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        start = new Date(target.getFullYear(), target.getMonth(), 1).toISOString();
        end = new Date(target.getFullYear(), target.getMonth() + 1, 0, 23, 59, 59).toISOString();
        const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        label = `${months[target.getMonth()]} ${target.getFullYear() + 543}`;
      } else if (timeFilter === 'all') {
        start = '2000-01-01'; end = '2100-01-01'; label = 'ทั้งหมด';
      } else { // weekly
        const d = now.getDay();
        const s = new Date(now.setDate(now.getDate() - d));
        start = s.toISOString();
        const e = new Date(s); e.setDate(e.getDate() + 6);
        end = e.toISOString();
        label = 'สัปดาห์นี้';
      }

      setCurrentDisplayDate(label);
      const db = await SQLite.openDatabaseAsync('my_wallet_eva.db');
      const rows: any = await db.getAllAsync(`SELECT * FROM transactions WHERE transaction_date >= ? AND transaction_date <= ?`, [start, end]);
      
      let inc = 0, exp = 0, volume = 0;
      const grouped: any = {};
      
      rows.forEach((item: any) => {
        if (item.type === 'income') inc += item.amount; else exp += item.amount;
        volume += item.amount;
        grouped[item.category] = (grouped[item.category] || 0) + item.amount;
      });

      const chartData = Object.keys(grouped).map(key => ({
        name: key,
        amount: grouped[key],
        color: categoryColors[key] || '#9CA3AF', // คราวนี้สีจะมาแล้วครับ!
        legendFontColor: "#B49CE5",
        legendFontSize: 12
      })).sort((a, b) => b.amount - a.amount);

      setData(chartData);
      setTotalIncome(inc);
      setTotalExpense(exp);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const netBalance = totalIncome - totalExpense;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}><Text style={styles.title}>MAGI SYSTEM : สรุป</Text></View>

      <View style={styles.timeFilterContainer}>
        {['daily', 'weekly', 'monthly', 'all'].map((f: any) => (
          <TouchableOpacity key={f} style={[styles.timeBtn, timeFilter === f && styles.timeBtnActive]} onPress={() => {setTimeFilter(f); setMonthOffset(0);}}>
            <Text style={[styles.timeBtnText, timeFilter === f && styles.timeBtnTextActive]}>{f.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {timeFilter === 'monthly' && (
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setMonthOffset(o => o - 1)}><Text style={styles.navText}>◀ ก่อนหน้า</Text></TouchableOpacity>
          <Text style={styles.monthLabel}>{currentDisplayDate}</Text>
          <TouchableOpacity onPress={() => setMonthOffset(o => o + 1)}><Text style={styles.navText}>ถัดไป ▶</Text></TouchableOpacity>
        </View>
      )}

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>ยอดเงินสุทธิ ({currentDisplayDate})</Text>
        <Text style={[styles.balanceValue, { color: netBalance >= 0 ? '#75F94C' : '#FF4A3D' }]}>฿ {netBalance.toLocaleString()}</Text>
        <View style={styles.flowRow}>
          <View style={styles.flowBox}><Text style={styles.flowLabel}>รายรับ</Text><Text style={styles.flowInc}>+฿{totalIncome.toLocaleString()}</Text></View>
          <View style={styles.flowBox}><Text style={styles.flowLabel}>รายจ่าย</Text><Text style={styles.flowExp}>-฿{totalExpense.toLocaleString()}</Text></View>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {loading ? <ActivityIndicator color="#75F94C" style={{marginTop: 50}} /> : (
          data.length === 0 ? <Text style={styles.empty}>ไม่มีข้อมูลในช่วงเวลานี้</Text> : (
            <>
              <PieChart
                data={data}
                width={screenWidth - 40}
                height={200}
                chartConfig={{ color: (o) => `rgba(255, 255, 255, ${o})` }}
                accessor={"amount"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
              <Text style={styles.sectionTitle}>สัดส่วนหมวดหมู่</Text>
              {data.map((item, i) => (
                <View key={i} style={styles.itemRow}>
                  <View style={[styles.dot, {backgroundColor: item.color}]} />
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemAmt}>฿{item.amount.toLocaleString()}</Text>
                </View>
              ))}
            </>
          )
        )}
        <View style={{height: 40}} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0616' },
  header: { paddingTop: 60, paddingBottom: 20, backgroundColor: '#1A0E35', alignItems: 'center', borderBottomWidth: 2, borderColor: '#75F94C' },
  title: { color: '#B49CE5', fontSize: 18, fontWeight: 'bold', letterSpacing: 2 },
  timeFilterContainer: { flexDirection: 'row', padding: 15, justifyContent: 'space-between' },
  timeBtn: { flex: 1, padding: 8, alignItems: 'center', backgroundColor: '#180C2E', marginHorizontal: 2, borderRadius: 8, borderWidth: 1, borderColor: '#331D60' },
  timeBtnActive: { borderColor: '#75F94C', backgroundColor: '#241447' },
  timeBtnText: { color: '#6A4C9C', fontSize: 10, fontWeight: 'bold' },
  timeBtnTextActive: { color: '#75F94C' },
  monthNav: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 15, backgroundColor: '#180C2E', padding: 10, borderRadius: 10 },
  navText: { color: '#75F94C', fontSize: 12 },
  monthLabel: { color: '#FFF', fontWeight: 'bold' },
  summaryCard: { backgroundColor: '#180C2E', marginHorizontal: 20, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#331D60', alignItems: 'center' },
  summaryTitle: { color: '#B49CE5', fontSize: 12, marginBottom: 10 },
  balanceValue: { fontSize: 32, fontWeight: 'bold', marginBottom: 15 },
  flowRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#331D60', paddingTop: 15, width: '100%' },
  flowBox: { flex: 1, alignItems: 'center' },
  flowLabel: { color: '#6A4C9C', fontSize: 10 },
  flowInc: { color: '#75F94C', fontWeight: 'bold' },
  flowExp: { color: '#FF4A3D', fontWeight: 'bold' },
  content: { padding: 20 },
  sectionTitle: { color: '#75F94C', fontWeight: 'bold', textAlign: 'center', marginVertical: 15 },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#180C2E', padding: 15, borderRadius: 12, marginBottom: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 15 },
  itemName: { flex: 1, color: '#FFF' },
  itemAmt: { color: '#FFF', fontWeight: 'bold' },
  empty: { color: '#6A4C9C', textAlign: 'center', marginTop: 50 }
});