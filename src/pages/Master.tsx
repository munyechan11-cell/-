import React from 'react';
import { useStore } from '../store';
import { Link } from 'react-router-dom';
import { ArrowLeft, Store, Users, Ticket, Calendar } from 'lucide-react';

export default function Master() {
  const { users, visits, coupons } = useStore();

  const owners = users.filter(u => u.role === 'owner');

  const getOwnerStats = (ownerId: string) => {
    const ownerVisits = visits.filter(v => v.storeId === ownerId);
    const ownerCoupons = coupons.filter(c => c.storeId === ownerId);
    const usedCoupons = ownerCoupons.filter(c => c.status === 'used');
    
    // Unique customers
    const uniqueCustomers = new Set(ownerVisits.map(v => v.customerId)).size;

    return {
      totalVisits: ownerVisits.length,
      totalCoupons: ownerCoupons.length,
      usedCoupons: usedCoupons.length,
      uniqueCustomers
    };
  };

  return (
    <div className="min-h-full bg-transparent pb-20">
      {/* Header */}
      <div className="bg-transparent text-[#2D1B15] p-6 pt-8 border-b border-[#E7E0D7] flex items-center">
        <Link to="/" className="p-2 bg-white/80 rounded-full hover:bg-white shadow-sm border border-[#E7E0D7] transition-colors mr-4">
          <ArrowLeft className="w-5 h-5 text-[#D84315]" />
        </Link>
        <div>
          <h1 className="text-2xl font-black tracking-tight">마스터 관리자</h1>
          <p className="text-[#795548] text-sm mt-1 font-medium">등록된 전체 사장님 현황</p>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#E7E0D7]">
            <div className="flex items-center text-[#795548] mb-2">
              <Store className="w-5 h-5 mr-2 text-[#D84315]" />
              <span className="font-bold">총 가맹점</span>
            </div>
            <p className="text-3xl font-black text-[#2D1B15]">{owners.length}<span className="text-lg font-medium text-[#795548] ml-1">곳</span></p>
          </div>
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#E7E0D7]">
            <div className="flex items-center text-[#795548] mb-2">
              <Users className="w-5 h-5 mr-2 text-[#D84315]" />
              <span className="font-bold">총 손님</span>
            </div>
            <p className="text-3xl font-black text-[#2D1B15]">{users.filter(u => u.role === 'customer').length}<span className="text-lg font-medium text-[#795548] ml-1">명</span></p>
          </div>
        </div>

        <h2 className="text-lg font-bold text-[#2D1B15] mb-4">가맹점 목록</h2>
        
        {owners.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 text-center shadow-sm border border-[#E7E0D7]">
            <p className="text-[#795548]">아직 등록된 사장님이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {owners.map(owner => {
              const stats = getOwnerStats(owner.id);
              return (
                <div key={owner.id} className="bg-white/90 backdrop-blur-sm rounded-3xl p-5 shadow-sm border border-[#E7E0D7]">
                  <div className="flex justify-between items-start mb-4 border-b border-[#E7E0D7]/50 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#2D1B15]">{owner.restaurantName || '이름 없는 가게'}</h3>
                      <p className="text-[#795548] text-sm mt-1">{owner.name} 사장님 • {owner.phone}</p>
                    </div>
                    <span className="bg-[#FFF3E0] text-[#D84315] text-xs font-bold px-3 py-1 rounded-full">
                      ID: {owner.id}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-[#F5F2EB]/50 rounded-2xl p-3 text-center">
                      <Users className="w-4 h-4 mx-auto mb-1 text-[#795548]" />
                      <p className="text-xs text-[#795548] mb-1">등록 고객</p>
                      <p className="font-bold text-[#2D1B15]">{stats.uniqueCustomers}명</p>
                    </div>
                    <div className="bg-[#F5F2EB]/50 rounded-2xl p-3 text-center">
                      <Calendar className="w-4 h-4 mx-auto mb-1 text-[#795548]" />
                      <p className="text-xs text-[#795548] mb-1">누적 방문</p>
                      <p className="font-bold text-[#2D1B15]">{stats.totalVisits}회</p>
                    </div>
                    <div className="bg-[#F5F2EB]/50 rounded-2xl p-3 text-center">
                      <Ticket className="w-4 h-4 mx-auto mb-1 text-[#795548]" />
                      <p className="text-xs text-[#795548] mb-1">쿠폰 사용</p>
                      <p className="font-bold text-[#2D1B15]">{stats.usedCoupons}/{stats.totalCoupons}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
