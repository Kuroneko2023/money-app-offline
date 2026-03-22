import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, StatusBar, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy'; // ใช้ Legacy ตามที่ระบบแนะนำ
import * as MailComposer from 'expo-mail-composer';
import * as LocalAuthentication from 'expo-local-authentication';

type Transaction = {
  id: number;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  transaction_date: string;
};

export default function HomeScreen() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  // --- 🛡️ ระบบความปลอดภัย ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // --- 🎨 ระบบเลือกหมวดหมู่ (Custom Picker เพื่อแก้ปัญหาสีขาว) ---
  const [showPicker, setShowPicker] = useState(false);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [editingId, setEditingId] = useState<number | null>(null);
  
  const expenseCategories = ['🍽️ อาหาร', '🚗 เดินทาง', '🛍️ ช้อปปิ้ง', '📄 บิล/ค่าเช่า', '🍿 บันเทิง', '🏥 สุขภาพ', '📦 อื่นๆ'];
  const incomeCategories = ['💰 เงินเดือน', '🎁 โบนัส', '📈 รายได้เสริม', '📦 อื่นๆ'];
  const [category, setCategory] = useState(expenseCategories[0]);

  // --- 🔐 ฟังก์ชันยืนยันตัวตน (เปิดแอปมาสแกนเลย) ---
  const handleAuthentication = async () => {
    try {
      setIsAuthenticating(true);
      const results = await LocalAuthentication.authenticateAsync({
        promptMessage: 'ยืนยันตัวตนเพื่อเข้าสู่ระบบ MAGI',
        disableDeviceFallback: false,
      });
      if (results.success) setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(true); // ถ้าเครื่องไม่มี hardware ให้ผ่านไปก่อน
    } finally {
      setIsAuthenticating(false);
    }
  };

  useEffect(() => { handleAuthentication(); }, []);

  // --- 💾 จัดการฐานข้อมูล SQLITE ---
  useEffect(() => {
    const setupDatabase = async () => {
      try {
        const database = await SQLite.openDatabaseAsync('my_wallet_eva.db');
        await database.execAsync(`
          CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            note TEXT,
            transaction_date TEXT NOT NULL
          );
        `);
        setDb(database);
        loadData(database);
      } catch (err: any) {
        setErrorMsg('MAGI SYSTEM FAILURE: ' + err.message);
      }
    };
    setupDatabase();
  }, []);

  const loadData = async (database?: SQLite.SQLiteDatabase) => {
    const targetDb = database || db;
    if (targetDb) {
      const allRows = await targetDb.getAllAsync('SELECT * FROM transactions ORDER BY transaction_date DESC');
      setTransactions(allRows as Transaction[]);
    }
  };

  // --- 📝 ฟังก์ชันบันทึก / แก้ไข ---
  const handleSave = async () => {
    if (!amount || !db) return Alert.alert("แจ้งเตือน", "กรุณาระบุจำนวนเงิน");

    try {
      if (editingId) {
        await db.runAsync('UPDATE transactions SET type=?, amount=?, category=?, note=? WHERE id=?', [type, parseFloat(amount), category, note, editingId]);
        Alert.alert("สำเร็จ", "อัปเดตข้อมูลเรียบร้อย");
      } else {
        await db.runAsync('INSERT INTO transactions (type, amount, category, note, transaction_date) VALUES (?,?,?,?,?)', [type, parseFloat(amount), category, note, new Date().toISOString()]);
        Alert.alert("สำเร็จ", "บันทึกลงเกราะ EVA-01 เรียบร้อย");
      }
      setAmount(''); setNote(''); setEditingId(null);
      loadData();
    } catch (error) { Alert.alert("ERROR", "บันทึกข้อมูลล้มเหลว"); }
  };

  const handleEdit = (item: Transaction) => {
    setEditingId(item.id); setType(item.type); setAmount(item.amount.toString()); setCategory(item.category); setNote(item.note || '');
  };

  const handleDelete = (id: number) => {
    Alert.alert("ลบรายการ", "คุณต้องการลบรายการนี้ทิ้งถาวรใช่หรือไม่?", [
      { text: "ยกเลิก" },
      { text: "ลบทิ้ง", style: "destructive", onPress: async () => {
          await db?.runAsync('DELETE FROM transactions WHERE id = ?', [id]);
          if (editingId === id) setEditingId(null);
          loadData();
      }}
    ]);
  };

  // --- 📧 ฟังก์ชันส่งออก EXCEL (ตัวที่แก้ให้ใช้ได้กับปัจจุบัน) ---
  const exportToExcel = async () => {
    try {
      const isAvailable = await MailComposer.isAvailableAsync();
      if (!isAvailable) return Alert.alert("Error", "ไม่พบแอปเมลในเครื่องครับ");

      const rows: any = await db?.getAllAsync('SELECT * FROM transactions ORDER BY transaction_date DESC');
      if (!rows || rows.length === 0) return Alert.alert("แจ้งเตือน", "ยังไม่มีข้อมูล");

      const header = "\uFEFFID,ประเภท,จำนวนเงิน,หมวดหมู่,บันทึก,วันที่เวลา\n";
      const csvData = rows.map((r: any) => {
        const typeStr = r.type === 'income' ? 'รายรับ' : 'รายจ่าย';
        const dateStr = new Date(r.transaction_date).toLocaleString('th-TH');
        return `${r.id},${typeStr},${r.amount},"${r.category}","${r.note || ''}",${dateStr}`;
      }).join('\n');

      const fileUri = FileSystem.documentDirectory + 'MAGI_REPORT.csv';
      
      // ✅ แก้เป็น 'utf8' ตรงๆ เพื่อเลี่ยง Error ใน SDK 54
      await FileSystem.writeAsStringAsync(fileUri, header + csvData, { encoding: 'utf8' });

      await MailComposer.composeAsync({
        recipients: ['sam16042546@gmail.com'],
        subject: 'MAGI System: สำรองข้อมูลบัญชี (Excel)',
        body: 'รายงานสรุปข้อมูลจากระบบ MAGI System',
        attachments: [fileUri]
      });

    } catch (error) {
      Alert.alert("Error", "เกิดข้อผิดพลาดในการส่งเมล");
    }
  };

  // --- 🔒 หน้าจอ Lock Screen ---
  if (!isAuthenticated) {
    return (
      <View style={styles.lockContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.lockIcon}>🛡️</Text>
        <Text style={styles.lockTitle}>MAGI SYSTEM</Text>
        <Text style={styles.lockStatus}>ACCESS RESTRICTED</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={handleAuthentication} disabled={isAuthenticating}>
          {isAuthenticating ? <ActivityIndicator color="#0B0616" /> : <Text style={styles.unlockBtnText}>ปลดล็อคระบบ</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsAuthenticated(true)} style={{marginTop: 30}}><Text style={{color:'#1A0E35'}}>DEBUG BYPASS</Text></TouchableOpacity>
      </View>
    );
  }

  const totals = transactions.reduce((acc: any, item: Transaction) => {
    if (item.type === 'income') acc.income += item.amount;
    else acc.expense += item.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const currentCategories = type === 'expense' ? expenseCategories : incomeCategories;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ส่วนหัวยอดเงิน */}
      <View style={styles.headerCard}>
        <Text style={styles.balanceLabel}>ยอดคงเหลือปัจจุบัน</Text>
        <Text style={styles.balanceValue}>฿ {(totals.income - totals.expense).toLocaleString()}</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statBox}><Text style={styles.statLabel}>รายรับ</Text><Text style={styles.statIncome}>+฿{totals.income.toLocaleString()}</Text></View>
          <View style={styles.divider} />
          <View style={styles.statBox}><Text style={styles.statLabel}>รายจ่าย</Text><Text style={styles.statExpense}>-฿{totals.expense.toLocaleString()}</Text></View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.formCard, editingId && styles.formCardEditing]}>
          <View style={styles.tabContainer}>
            <TouchableOpacity style={[styles.tabButton, type === 'expense' && styles.tabExpenseActive]} onPress={() => {setType('expense'); setCategory(expenseCategories[0]);}}><Text style={styles.tabText}>รายจ่าย</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.tabButton, type === 'income' && styles.tabIncomeActive]} onPress={() => {setType('income'); setCategory(incomeCategories[0]);}}><Text style={[styles.tabText, type === 'income' && {color: '#0B0616'}]}>รายรับ</Text></TouchableOpacity>
          </View>

          <Text style={styles.inputLabel}>จำนวนเงิน</Text>
          <TextInput style={styles.input} placeholder="เช่น 150" placeholderTextColor="#4A2A85" keyboardType="numeric" value={amount} onChangeText={setAmount} />
          
          <Text style={styles.inputLabel}>หมวดหมู่</Text>
          <TouchableOpacity style={styles.customPickerBtn} onPress={() => setShowPicker(true)}>
            <Text style={styles.customPickerBtnText}>{category}</Text>
            <Text style={{color: '#75F94C'}}>▼</Text>
          </TouchableOpacity>

          <Text style={styles.inputLabel}>บันทึกช่วยจำ</Text>
          <TextInput style={styles.input} placeholder="รายละเอียด..." placeholderTextColor="#4A2A85" value={note} onChangeText={setNote} />

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={[styles.submitButton, editingId ? styles.updateButton : styles.saveButton]} onPress={handleSave}>
              <Text style={styles.submitText}>{editingId ? 'อัปเดต' : 'บันทึกรายการ'}</Text>
            </TouchableOpacity>
            {editingId && <TouchableOpacity style={styles.cancelButton} onPress={() => {setEditingId(null); setAmount(''); setNote('');}}><Text style={styles.cancelText}>ยกเลิก</Text></TouchableOpacity>}
          </View>
        </View>

        <TouchableOpacity style={styles.exportBtn} onPress={exportToExcel}><Text style={styles.exportBtnText}>📧 ส่งออก Excel ไปยัง Gmail</Text></TouchableOpacity>

        <Text style={styles.sectionTitle}>ประวัติรายการ</Text>
        {transactions.map((item) => (
          <View key={item.id} style={styles.itemCard}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemNoteText}>{item.note || item.category}</Text>
              <Text style={styles.itemCategoryText}>{item.category} • {new Date(item.transaction_date).toLocaleDateString('th-TH')}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.itemPrice, { color: item.type === 'income' ? '#75F94C' : '#FF4A3D' }]}>{item.type === 'income' ? '+' : '-'} {item.amount.toLocaleString()}</Text>
              <View style={{ flexDirection: 'row', marginTop: 8 }}>
                <TouchableOpacity onPress={() => handleEdit(item)}><Text style={{ color: '#00D0FF', marginRight: 15 }}>แก้ไข</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)}><Text style={{ color: '#FF4A3D' }}>ลบ</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* --- 🌑 Modal เลือกหมวดหมู่ (Custom Picker เพื่อคุมสีหน้าจอ) --- */}
      <Modal visible={showPicker} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>เลือกหมวดหมู่</Text>
            <FlatList
              data={currentCategories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.categoryItem} onPress={() => { setCategory(item); setShowPicker(false); }}>
                  <Text style={styles.categoryItemText}>{item}</Text>
                  {category === item && <Text style={{color: '#75F94C'}}>✓</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowPicker(false)}>
              <Text style={styles.closeModalBtnText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0616' },
  lockContainer: { flex: 1, backgroundColor: '#0B0616', justifyContent: 'center', alignItems: 'center', padding: 20 },
  lockIcon: { fontSize: 80, marginBottom: 20 },
  lockTitle: { color: '#75F94C', fontSize: 28, fontWeight: 'bold', letterSpacing: 5 },
  lockStatus: { color: '#FF4A3D', fontSize: 16, fontWeight: 'bold', marginTop: 10 },
  unlockBtn: { marginTop: 40, backgroundColor: '#75F94C', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 12 },
  unlockBtnText: { color: '#0B0616', fontWeight: 'bold', fontSize: 16 },

  headerCard: { backgroundColor: '#1A0E35', paddingTop: 60, paddingBottom: 30, paddingHorizontal: 25, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, elevation: 10, shadowColor: '#75F94C' },
  balanceLabel: { color: '#B49CE5', fontSize: 14, marginBottom: 8 },
  balanceValue: { color: '#75F94C', fontSize: 42, fontWeight: 'bold' },
  statsContainer: { flexDirection: 'row', backgroundColor: '#241447', borderRadius: 16, padding: 15, marginTop: 20 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#B49CE5', fontSize: 12 },
  statIncome: { color: '#75F94C', fontSize: 18, fontWeight: 'bold' },
  statExpense: { color: '#FF4A3D', fontSize: 18, fontWeight: 'bold' },
  divider: { width: 1, backgroundColor: '#4A2A85', marginHorizontal: 15 },
  
  content: { padding: 20 },
  formCard: { backgroundColor: '#180C2E', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#331D60' },
  formCardEditing: { borderColor: '#00D0FF' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0B0616', borderRadius: 14, padding: 5, marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  tabIncomeActive: { backgroundColor: '#75F94C' },
  tabExpenseActive: { backgroundColor: '#FF4A3D' },
  tabText: { color: '#FFF', fontWeight: 'bold' },
  
  inputLabel: { color: '#B49CE5', fontSize: 13, marginBottom: 8, marginLeft: 5 },
  input: { backgroundColor: '#0B0616', borderRadius: 12, padding: 15, fontSize: 16, marginBottom: 15, color: '#FFFFFF', borderWidth: 1, borderColor: '#331D60' },
  
  customPickerBtn: { backgroundColor: '#0B0616', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#331D60', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customPickerBtnText: { color: '#75F94C', fontSize: 16, fontWeight: 'bold' },
  
  actionButtonsRow: { flexDirection: 'row', gap: 12 },
  submitButton: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center' },
  saveButton: { backgroundColor: '#4A2A85' },
  updateButton: { backgroundColor: '#00D0FF' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FF4A3D' },
  cancelText: { color: '#FF4A3D', fontWeight: 'bold' },
  
  exportBtn: { backgroundColor: '#180C2E', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#4A2A85', alignItems: 'center', marginBottom: 25 },
  exportBtnText: { color: '#B49CE5', fontSize: 15, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#E0D4F5', marginBottom: 15 },
  itemCard: { backgroundColor: '#180C2E', flexDirection: 'row', padding: 16, borderRadius: 20, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#331D60' },
  itemInfo: { flex: 1 },
  itemNoteText: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  itemCategoryText: { fontSize: 12, color: '#B49CE5' },
  itemPrice: { fontSize: 18, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: '#180C2E', borderRadius: 25, padding: 20, borderWidth: 1, borderColor: '#75F94C', maxHeight: '80%' },
  modalTitle: { color: '#75F94C', fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  categoryItem: { padding: 18, borderBottomWidth: 1, borderBottomColor: '#331D60', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryItemText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  closeModalBtn: { marginTop: 20, padding: 15, alignItems: 'center' },
  closeModalBtnText: { color: '#FF4A3D', fontWeight: 'bold', fontSize: 16 }
});