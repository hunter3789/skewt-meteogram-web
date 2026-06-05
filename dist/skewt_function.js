/**
 * SkewT Indices Calculator
 *
 * Written by ChangJae Lee (2022 - 2026)
 * 
**/

if (!Math.log10) {
  Math.log10 = Math.log10 || function (x) {
    return Math.log(x) * Math.LOG10E;
  };
}

function findTC(thetae, xp)
{
    //this function returns tempC for a given P and theta-e
    //it's used to find lfc, el, and cape
    var crit = 0.1;//criteria
    var eq0 = thetae;
    var eq1 = 0;
    var tlev = 10 - ((1000-xp)/10);
    //calc thetae for tlev and p
    for(var k=0; k<100; k++){
        eq1 = calcThetaE(xp, tlev, tlev);
        var diff = Math.abs(eq0-eq1);
        if(diff < 0.1){//close enough
            break;
        }else if(eq1>eq0){//our try (eq1) is larger than the obs theta-e (eq0)
            tlev = tlev - (diff/10);//so we subtract half the difference from tlev and try again
        }else{//otherwise, we add the difference 
            tlev = tlev + (diff/10);    
        }
    }
    return tlev;
}

function calcThetaE(pres,t,dp)
{
    var vp=calcVaporPressure(dp);//ambient vapor pressure
    var w=calcMixingRatio(vp, pres);
    var lcl = calcLcl(pres,t,dp);
    var tlclk = lcl.t;
    var PT = (t + 273.15) * Math.pow(1000/pres, 0.2854*(1-(0.00028*w)));
    var EPTK = PT * Math.exp(((3.376/tlclk)-0.00254)*w*(1+(0.00081*w)));
    return Math.round(EPTK*10)/10;
}

function calcVaporPressure( temp )
{
    var vp = 6.11 * Math.exp(5423 * (1/273 - 1/(temp+273)));
    return vp;
}

function calcMixingRatio (vapor, press)
{
    return (((0.62197*vapor)/(press-vapor))*1000.0);
}

function log10(x) {
    return (Math.log(x) / Math.log(10));    
}

function calcLcl(pres, t, td)
{
  t  += 273.15;
  td += 273.15;
  var RCP = 0.286;

  var ESTD = -2937.4/td-4.9283*Math.log10(td) + 23.5471;
  ESTD = Math.pow(10.0, ESTD);
  var WS = 0.622*ESTD/pres;
  var PUP = pres;
 
  var cond = true;
  var TNEW, ESNEW, WSNEW;
  var PLCL = TLCL = -999.;
  while (cond) {
    PUP = PUP-1.;
    var TNEW = t*Math.pow((PUP/pres), RCP);
    ESNEW = -2937.4/TNEW-4.9283*Math.log10(TNEW) + 23.5471;
    ESNEW = Math.pow(10., ESNEW);
    WSNEW = 0.622*ESNEW/PUP;
    if (WS >= WSNEW) {
      PLCL = PUP;
      TLCL = TNEW;
      break;
    }
  }

  var lcl = {};
  lcl.p = PLCL;
  lcl.t = TLCL; //Kelvin

  return lcl;
}

function calcCcl(data)
{
  var tmpData = [];
  var PCCL = TCCL = -999.;
  var ESTD, DWS, TWS;
  var KCNT = 0;
  var TRATE, DRATE;

  for (var n=1; n<data.length; n++) {
    TRATE=(parseFloat(data[n].ta)-parseFloat(data[n-1].ta))/(-parseFloat(data[n].pres)+parseFloat(data[n-1].pres));
    DRATE=(parseFloat(data[n].td)-parseFloat(data[n-1].td))/(-parseFloat(data[n].pres)+parseFloat(data[n-1].pres));

    var LOOPCNT=0

    for (var m=parseInt(data[n-1].pres); m>=parseInt(data[n].pres); m--) {
      if (m == parseInt(data[n-1].pres)) {
        if (tmpData[KCNT] == undefined) {
          tmpData[KCNT] = {};
        }
        tmpData[KCNT].pres = parseFloat(m);
        tmpData[KCNT].ta = parseFloat(data[n-1].ta);
        tmpData[KCNT].td = parseFloat(data[n-1].td);
        KCNT++;
      }
      else if (m == parseInt(data[n].pres)) {
        continue;
      }
      else {
        LOOPCNT++;
        if (tmpData[KCNT] == undefined) {
          tmpData[KCNT] = {};
        }
        tmpData[KCNT].pres = parseFloat(m);
        tmpData[KCNT].ta = parseFloat(data[n-1].ta) + TRATE*LOOPCNT;
        tmpData[KCNT].td = parseFloat(data[n-1].td) + DRATE*LOOPCNT;          
        KCNT++;
      }
    }

    if (n == data.length - 1) {
      if (tmpData[KCNT] == undefined) {
        tmpData[KCNT] = {};
      }
      tmpData[KCNT].pres = parseFloat(data[data.length-1].pres);
      tmpData[KCNT].ta = parseFloat(data[data.length-1].ta);
      tmpData[KCNT].td = parseFloat(data[data.length-1].td);
      KCNT++;
    }
  }      

  ESTD = calcVapor(parseFloat(tmpData[0].td));
  DWS = 0.622*ESTD/parseFloat(tmpData[0].pres);
  for (var i=1; i<tmpData.length; i++) {
    ESTD = calcVapor(parseFloat(tmpData[i].ta));
    TWS = 0.622*ESTD/parseFloat(tmpData[i].pres);
    if (DWS >= TWS) {
      PCCL = parseFloat(tmpData[i].pres);
      TCCL = parseFloat(tmpData[i].ta);
      break;
    }
  }

  var ccl = {};
  ccl.p = PCCL;
  ccl.t = TCCL + 273.15; //Kelvin

  //console.log('ccl', fprtohh(PCCL));
  return ccl;
}

function calcVapor(TMP) {
  var ALOGVP = -2937.4/(TMP+273.15) - 4.9283*log10(TMP+273.15) + 23.5471;
  var VAPOR = Math.pow(10, ALOGVP);

  return VAPOR;
}

function fprtohh(pr) {
  var value;

  if (pr < 0) {
    value = -999;
  }

  if (pr >= 234.52) {
    value = 44308*(1. - Math.pow((pr/1013.25),0.19023));
  }
  else{
    value = 10769+6381.6*Math.log(234.52/pr);
  }

  return value;
}

function std_atmos(pres_Pa) {
  var pr = pres_Pa*0.01;
  var height = 44307.692 * (1.0 - Math.pow((pr/1013.25),0.190));

  return height;
}

function satarry(pbase, tbase, TSATM, PSATM, maxpres) 
{
  var Tk=273.15;
  var g=9.81;
  var Rv=461.51;
  var Rd=287.05;
  var Cpd=1005.;
  var Tk=273.15;
  var HL=2.5*(Math.pow(10,6));
  var HLD=Math.pow(HL,2);
  var EIP=0.622;
  var EIPD=Math.pow(EIP,2);
  var HLCP=HL/Cpd;
  var GAMMAd=g/Cpd;
  var JSTEP=-1;
  var HIGH=0.;
  var TEM1=tbase;
  var isat=0;

  for (var j=1050; j>maxpres; j--) {
    var Es=6.107*Math.exp(HL/Rv*((1./Tk)-1./TEM1));
    var PARTU=EIP *HL *Es/(Rd*TEM1);
    var PARTL=EIPD*HLD*Es/(Cpd*Rd*(Math.pow(TEM1,2)));
    var GAMMAs1=GAMMAd*(1.+PARTU/j)/(1.+PARTL/j);
    var GAMMAs2=GAMMAd*(1.+PARTU/(j+JSTEP))/(1.+PARTL/(j+JSTEP));
    var DHGT1=(3. - log10(parseFloat(j)));
    var DHGT2=(3. - log10(parseFloat(j+JSTEP)));
    var DZ1=Rd*TEM1/g*Math.log(parseFloat(j)/parseFloat(j+JSTEP));
    var TEM2=TEM1-GAMMAs1*DZ1;

    if (j <= parseInt(pbase)) {
      HIGH=HIGH+DZ1;
      TEM1=TEM2;
      TSATM[isat]=TEM1;
      PSATM[isat]=parseFloat(j);
      isat++;
    }
  }

  return isat;
}

function satarry1(plcl, tlcl, TSATM, PSATM) 
{
  var Tk=273.15;
  var g=9.81;
  var Rv=461.51;
  var Rd=287.05;
  var Cpd=1005.;
  var Tk=273.15;
  var HL=2.5*(Math.pow(10,6));
  var HLD=Math.pow(HL,2);
  var EIP=0.622;
  var EIPD=Math.pow(EIP,2);
  var HLCP=HL/Cpd;
  var GAMMAd=g/Cpd;
  var JSTEP=-1;
  var HIGH=0.;
  var TEM1=tlcl;
  var isat=0;

  for (var j=parseInt(plcl); j<=1050; j++) {
    var Es=6.107*Math.exp(HL/Rv*((1./Tk)-1./TEM1));
    var PARTU=EIP *HL *Es/(Rd*TEM1);
    var PARTL=EIPD*HLD*Es/(Cpd*Rd*(Math.pow(TEM1,2)));
    var GAMMAs1=GAMMAd*(1.+PARTU/j)/(1.+PARTL/j);
    var GAMMAs2=GAMMAd*(1.+PARTU/(j+JSTEP))/(1.+PARTL/(j+JSTEP));
    var DHGT1=(3. - log10(parseFloat(j)));
    var DHGT2=(3. - log10(parseFloat(j+JSTEP)));
    var DZ1=Rd*TEM1/g*Math.log(parseFloat(j)/parseFloat(j+JSTEP));
    var TEM2=TEM1+GAMMAs1*DZ1;

    HIGH=HIGH-DZ1;
    TEM1=TEM2;
    TSATM[isat]=TEM1;
    PSATM[isat]=parseFloat(j);
    isat++;
  }

  return isat;
}

function calcLfc(data, lcl)
{
  var AMIS = -999., C2K = 273.15;
  var TSATM = [], PSATM = [];

  var PLFC = AMIS, TLFC = AMIS;

  var maxpres = parseInt(data[data.length-1].pres);
  var isat = satarry(lcl.p,lcl.t,TSATM,PSATM,maxpres);

  for (var n=1; n<data.length; n++) {
    if (data[n].pres == "SFC") {
      continue;
    }

    if (parseFloat(data[n].pres) <= lcl.p) {
      var RATE=(parseFloat(data[n].ta)-parseFloat(data[n-1].ta))/(fprtohh(parseFloat(data[n].pres))-fprtohh(parseFloat(data[n-1].pres)));
      var DIF_H=fprtohh(lcl.p)-fprtohh(parseFloat(data[n-1].pres));
      var TEMPLCL=RATE*DIF_H;
      TEMPLCL=parseFloat(data[n-1].ta)+TEMPLCL;
      break;
    }
  }

  var icnt = 0;
  var ATEMP, BTEMP, PMBMI;
  var DIFF, DIFF_I, DIFF_J, DRATE, DPMB, DTMP, UPMB, UTMP;
  var chk = false;
  for (var n=1; n<data.length; n++) {
    if (data[n].pres == "SFC") {
      continue;
    }

    if (data[n].pres >= lcl.p) {
      continue;
    }

    if (icnt == 0) {
      ATEMP = parseFloat(data[n].ta);
      BTEMP = TEMPLCL;
      PMBMI = lcl.p;
    }
    else {
      ATEMP = parseFloat(data[n].ta);
      BTEMP = parseFloat(data[n-1].ta);
      PMBMI = parseFloat(data[n-1].pres);
    }
    icnt++;

    for (var m=0; m<isat; m++) {
      if (parseInt(PMBMI) == parseInt(PSATM[m])) {
        DIFF_J = BTEMP - (TSATM[m]-C2K);
        for (var l=m+1; l<isat; l++) {
          if (parseInt(data[n].pres) == parseInt(PSATM[l])) {
            DIFF_I = ATEMP - (TSATM[l]-C2K);
            break;
          }       
        }

        if ((DIFF_I*DIFF_J) < 0) {
          DRATE=(ATEMP-BTEMP)/(-parseFloat(data[n].pres)+PMBMI);
          DPMB=PMBMI;
          DTMP=BTEMP;
          UPMB=parseFloat(data[n].pres);
          UTMP=ATEMP;
          chk = true;
          break;
        }
      }
    }

    if (chk) {
      var VTEMP, DTRS;

      VTEMP=DTMP;
      DTRS=1.;

      for (var m=0; m<isat; m++) {
        if (parseInt(PSATM[m]) <= parseInt(DPMB) && parseInt(PSATM[m]) >= parseInt(UPMB)) {
          DIFF = Math.abs(VTEMP-(TSATM[m]-C2K));
          if (DIFF < DTRS) {
            DTRS=DIFF;
            PLFC=PSATM[m];
            TLFC=TSATM[m];
          }
          VTEMP=VTEMP+DRATE;
        }           
      }

      break;
    }
  }

  var lfc = {};
  lfc.p = PLFC;
  lfc.t = TLFC; //Kelvin

  return lfc;
}

function calcEl(data, lcl, ccl, lfc)
{
  var AMIS = -999., C2K = 273.15;
  var TSATM = [], PSATM = [];

  var PEL = AMIS, TEL = AMIS;

  var ATEMP, BTEMP;
  var DIFF, DIFF_I, DIFF_J, DRATE, DPMB, DTMP, UPMB, UTMP;
  var chk = false;

  if (lfc.p == ccl.p && lfc.t == ccl.t) {
    var maxpres = parseInt(data[data.length-1].pres);
    var isat = satarry(ccl.p,ccl.t,TSATM,PSATM,maxpres);
  
    for (var n=1; n<data.length; n++) {
      if (data[n].pres == "SFC") {
        continue;
      }

      if (parseFloat(data[n].pres) > lfc.p) {
        continue;
      }

      if (parseFloat(data[n-1].pres) > lfc.p) {
        continue;
      }

      ATEMP = parseFloat(data[n].ta);
      BTEMP = parseFloat(data[n-1].ta);

      for (m=0; m<isat; m++) {
        if (parseInt(data[n-1].pres) == parseInt(PSATM[m])) {
          DIFF_J = BTEMP - (TSATM[m]-C2K);
          for (var l=m+1; l<isat; l++) {
            if (parseInt(data[n].pres) == parseInt(PSATM[l])) {
              DIFF_I = ATEMP - (TSATM[l]-C2K);
              break;
            }
          }

          if (((DIFF_I*DIFF_J) <= 0) || (n == data.length-1)) {
            DRATE=(ATEMP-BTEMP)/(-parseFloat(data[n].pres)+parseFloat(data[n-1].pres));
            DPMB=parseFloat(data[n-1].pres);
            DTMP=BTEMP;
            UPMB=parseFloat(data[n].pres);
            UTMP=ATEMP;
            chk = true;
            break;
          }
        }
      }

      if (chk) {
        break;
      }
    }
  }
  else {
    var maxpres = parseInt(data[data.length-1].pres);
    var isat = satarry(lcl.p,lcl.t,TSATM,PSATM,maxpres);
  
    for (var n=1; n<data.length; n++) {
      if (data[n].pres == "SFC") {
        continue;
      }

      if (parseFloat(data[n-1].pres) >= lfc.p) {
        continue;
      }

      ATEMP = parseFloat(data[n].ta);
      BTEMP = parseFloat(data[n-1].ta);

      for (m=0; m<isat; m++) {
        if (parseInt(data[n-1].pres) == parseInt(PSATM[m])) {
          DIFF_J = BTEMP - (TSATM[m]-C2K);
          for (var l=m+1; l<isat; l++) {
            if (parseInt(data[n].pres) == parseInt(PSATM[l])) {
              DIFF_I = ATEMP - (TSATM[l]-C2K);
              break;
            }
          }

          if ((DIFF_I*DIFF_J <= 0) || (n == data.length-1)) {
            DRATE=(ATEMP-BTEMP)/(-parseFloat(data[n].pres)+parseFloat(data[n-1].pres));
            DPMB=parseFloat(data[n-1].pres);
            DTMP=BTEMP;
            UPMB=parseFloat(data[n].pres);
            UTMP=ATEMP;
            chk = true;
            break;
          }
        }
      }

      if (chk) {
        break;
      }
    }
  }

  if (chk) {
    if (DIFF_J > DIFF_I) {
      PEL=lfc.p;
      TEL=lfc.t;
    }
    else {
      var VTEMP, DTRS;

      VTEMP=DTMP;
      DTRS=1.;

      for (var m=0; m<isat; m++) {
        if (parseInt(PSATM[m]) <= parseInt(DPMB) && parseInt(PSATM[m]) >= parseInt(UPMB)) {
          DIFF = Math.abs(VTEMP-(TSATM[m]-C2K));
          if (DIFF < DTRS) {
            DTRS=DIFF;
            PEL=PSATM[m];
            TEL=TSATM[m];
          }

          if ((m == isat-1) && ((TSATM[m]-C2K) >= (VTEMP+DTRS))) {
            PEL=parseFloat(data[data.length-1].pres);
            TEL=parseFloat(data[data.length-1].ta) + C2K;
          }

          VTEMP=VTEMP+DRATE;
        }           
      }
    }
  }

  var el = {};
  el.p = PEL;
  el.t = TEL; //Kelvin

  return el;
}

function calcCape(data, lcl, ccl, lfc, el)
{
  var cape = {};
  var AMIS = -999., C2K = 273.15;
  var TSATM = [], PSATM = [];

  var TCAPE = AMIS;

  if (lfc.p == AMIS || el.p == AMIS) {
    cape.value = TCAPE;
    return cape;
  }

  if (lfc.p == el.p) {
    cape.value = TCAPE;
    return cape;
  }

  // CALC SATARRY COORD. FROM LFC TO EL
  var maxpres = parseInt(data[data.length-1].pres);
  var isat = satarry(lcl.p, lcl.t, TSATM, PSATM, maxpres);

  // FILLING CAPE AREA FROM LFC TO EL
  var kk = 0;
  var Tenv = [], Penv = [], Henv = [], Tpcl = [];
  var P, T;
  for (var k=data.length-2; k>=0; k--) {
    if (data[k].pres == "SFC") {
      continue;
    }

    if (parseFloat(data[k].ta) > AMIS && parseFloat(data[k].pres) < lfc.p && parseFloat(data[k].pres) > el.p) {
      P = parseFloat(data[k].pres)*100.;
      T = parseFloat(data[k].ta)+C2K;

      Tenv[kk] = T;
      Penv[kk] = parseFloat(data[k].pres);
      Henv[kk] = parseFloat(data[k].gh);

      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Henv[kk] = std_atmos(parseFloat(data[k].pres)*100);
      }

      if (data[k+1].gh == undefined || parseFloat(data[k+1].gh) == AMIS) {
        Henv[kk+1] = std_atmos(parseFloat(data[k+1].pres)*100);
      }

      for (var n=0; n<isat; n++) {
        if (parseInt(PSATM[n]) == parseInt(data[k].pres)) {
          Tpcl[kk] = TSATM[n];
          break;
        }
      }

      kk++;
    }
  }

  // CALCULATE GPH FOR LFC AND EL
  var Hlfc = AMIS, Hel = AMIS, delP;
  var Hlow = AMIS, Plow = AMIS, Hupr = AMIS, Pupr = AMIS;
  for (var k=0; k<data.length; k++) {
    if (el.p > parseFloat(data[k].pres)) {
      Hlow=parseFloat(data[k-1].gh);
      if (data[k-1].gh == undefined || parseFloat(data[k-1].gh) == AMIS) {
        Hlow=std_atmos(parseFloat(data[k-1].pres)*100);
      }
      Plow=parseFloat(data[k-1].pres);
      Hupr=parseFloat(data[k].gh)
      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Hupr=std_atmos(parseFloat(data[k].pres)*100);
      }
      Pupr=parseFloat(data[k].pres);
      break;
    }
  }

  if (el.p == parseFloat(data[data.length-1].pres)) {
    Hlow=parseFloat(data[data.length-2].gh);
    if (data[data.length-2].gh == undefined || parseFloat(data[data.length-2].gh) == AMIS) {
      Hlow=std_atmos(parseFloat(data[data.length-2].pres)*100);
    }
    Plow=parseFloat(data[data.length-2].pres);
    Hupr=parseFloat(data[data.length-1].gh)
    if (data[data.length-1].gh == undefined || parseFloat(data[data.length-1].gh) == AMIS) {
      Hupr=std_atmos(parseFloat(data[data.length-1].pres)*100);
    }
    Pupr=parseFloat(data[data.length-1].pres);
  }

  if (Hupr != AMIS && Hlow != AMIS) {
    delP=(Math.log(el.p)-Math.log(Plow))/(Math.log(Pupr)-Math.log(Plow))
    Hel=Hlow+(Hupr-Hlow)*delP;
  }

  for (var k=0; k<data.length; k++) {
    if (lfc.p > parseFloat(data[k].pres)) {
      Hlow=parseFloat(data[k-1].gh);
      if (data[k-1].gh == undefined || parseFloat(data[k-1].gh) == AMIS) {
        Hlow=std_atmos(parseFloat(data[k-1].pres)*100);
      }
      Plow=parseFloat(data[k-1].pres);
      Hupr=parseFloat(data[k].gh)
      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Hupr=std_atmos(parseFloat(data[k].pres)*100);
      }
      Pupr=parseFloat(data[k].pres);
      break;
    }
  }

  if (Hupr != AMIS && Hlow != AMIS) {
    delP=(Math.log(lfc.p)-Math.log(Plow))/(Math.log(Pupr)-Math.log(Plow))
    Hlfc=Hlow+(Hupr-Hlow)*delP;
  }

  // CALCULATE CAPE FROM LFC TO EL
  var TSUM=0.;
  var tr_Tel=2.*(Tpcl[0]-Tenv[0])/(el.t+Tenv[0]);
  var Sum_el=0.5*(Hel-Henv[0])*tr_Tel*9.8;

  kk = Tenv.length-1;
  var tr_Tlfc=2.*(Tpcl[kk]-Tenv[kk])/(lfc.t+Tenv[kk]);
  var Sum_lfc=0.5*(Henv[kk]-Hlfc)*tr_Tlfc*9.8;
  TSUM=Sum_el+Sum_lfc;

  var delh, delt, avet, sum;
  for (var k=0; k<kk; k++) {
    delh=Henv[k]-Henv[k+1];
    delt=0.5*((Tpcl[k]-Tenv[k])+(Tpcl[k+1]-Tenv[k+1]));
    avet=0.5*(Tenv[k]+Tenv[k+1]);
    sum=(delh*delt/avet)*9.8;
    TSUM=TSUM+sum;
  }
 
  TCAPE=TSUM;
  if (TCAPE <= 0) {
    TCAPE=AMIS;
  }
  else {
    var polygon = [];

    for (var n=0; n<isat; n++) {
      if (PSATM[n] > lfc.p || PSATM[n] < el.p) {
        continue;
      }
      var d = {};
      d.ta = TSATM[n] - C2K;
      d.pres = PSATM[n];
      polygon.push(d) 
    }

    var d = {};
    d.ta = el.t-C2K;
    d.pres = el.p;
    polygon.push(d);

    for (var k=0; k<Tenv.length; k++) {
      var d = {};
      d.ta = Tenv[k]-C2K;
      d.pres = Penv[k];
      polygon.push(d);
    }

    if (lfc.p == lcl.p) {
      for (var k=0; k<data.length; k++) {
        if (parseFloat(data[k].pres) < lfc.p) {
          break;
        }        
      }

      var d = {};
      d.ta = parseFloat(data[k-1].ta) - (parseFloat(data[k-1].ta) - parseFloat(data[k].ta))/(parseFloat(data[k-1].pres) - parseFloat(data[k].pres)) * (parseFloat(data[k-1].pres) - lfc.p);
      d.pres = lfc.p;
      polygon.push(d);
    }

    var d = {};
    d.ta = lfc.t-C2K;
    d.pres = lfc.p;
    polygon.push(d);
  }

  cape.value = TCAPE;
  cape.polygon = polygon;

  return cape;
}

function calcCin(data, lcl, ccl, lfc, el)
{
  var cin = {};
  var polygon = [];
  var AMIS = -999., C2K = 273.15;
  var TSATM = [], PSATM = [];

  var TCIN = AMIS;

  if (lfc.p == AMIS || el.p == AMIS) {
    cin.value = TCIN;
    return cin;
  }

  // CALC SATARRY COORD. FROM LCL TO LFC
  var maxpres = parseInt(data[data.length-1].pres);
  var isat = satarry(lcl.p, lcl.t, TSATM, PSATM, maxpres);

  for (var n=0; n<isat; n++) {
    if (PSATM[n] > lcl.p || PSATM[n] < lfc.p) {
      continue;
    }
    var d = {};
    d.ta = TSATM[n] - C2K;
    d.pres = PSATM[n];
    polygon.push(d) 
  }

  // FILLING CIN AREA FROM LCL TO LFC
  var kk = 0;
  var Tenv = [], Penv = [], Henv = [], Tpcl = [];
  var P, T;
  for (var k=data.length-1; k>=0; k--) {
    if (data[k].pres == "SFC") {
      continue;
    }

    if (parseFloat(data[k].ta) > AMIS && parseFloat(data[k].pres) < lcl.p && parseFloat(data[k].pres) > lfc.p) {
      P = parseFloat(data[k].pres)*100.;
      T = parseFloat(data[k].ta)+C2K;

      Tenv[kk] = T;
      Penv[kk] = parseFloat(data[k].pres);
      Henv[kk] = parseFloat(data[k].gh);

      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Henv[kk] = std_atmos(parseFloat(data[k].pres)*100);
      }

      if (data[k+1].gh == undefined || parseFloat(data[k+1].gh) == AMIS) {
        Henv[kk+1] = std_atmos(parseFloat(data[k+1].pres)*100);
      }

      for (var n=0; n<isat; n++) {
        if (parseInt(PSATM[n]) == parseInt(data[k].pres)) {
          Tpcl[kk] = TSATM[n];
          break;
        }
      }

      kk++;
    }
  }

  // SEARCH Tenv AT LCL HEIGHT
  var Hlow = AMIS, Plow = AMIS, Hupr = AMIS, Pupr = AMIS;
  var Tlcle, Hlcle, Hlcl, Hlfc, delP;
  for (var k=data.length-1; k>=0; k--) {
    if (parseFloat(data[k].ta) > AMIS && parseFloat(data[k].pres) >= lcl.p) {
      break;
    }
  }

  Tlcle = calcMidval(lcl.p, parseFloat(data[k].pres), parseFloat(data[k+1].pres), parseFloat(data[k].ta), parseFloat(data[k+1].ta));
  if (data[k].gh == undefined || data[k+1].gh == undefined || parseFloat(data[k].gh) == AMIS || parseFloat(data[k+1].gh) == AMIS) {
    Hlcle = calcMidval(lcl.p, parseFloat(data[k].pres), parseFloat(data[k+1].pres), std_atmos(parseFloat(data[k].pres)*100), std_atmos(parseFloat(data[k+1].pres)*100));
  }
  else {
    Hlcle = calcMidval(lcl.p, parseFloat(data[k].pres), parseFloat(data[k+1].pres), parseFloat(data[k].gh), parseFloat(data[k+1].gh));
  }
  Tenv[kk] = Tlcle + C2K;
  Penv[kk] = lcl.p;
  Henv[kk] = Hlcle;
  Tpcl[kk] = lcl.t;

  if (Tpcl[kk] >= Tenv[kk]) {
    cin.value = TCIN;
    return cin;
  }

  // CALCULATE GPH FOR LCL AND LFC
  Hlcl = AMIS; Hlfc = AMIS;
  for (var k=0; k<data.length; k++) {
    if (lfc.p > parseFloat(data[k].pres)) {
      Hlow=parseFloat(data[k-1].gh);
      if (data[k-1].gh == undefined || parseFloat(data[k-1].gh) == AMIS) {
        Hlow = std_atmos(parseFloat(data[k-1].pres)*100);
      }
      Plow=parseFloat(data[k-1].pres);
      Hupr=parseFloat(data[k].gh)
      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Hupr = std_atmos(parseFloat(data[k].pres)*100);
      }
      Pupr=parseFloat(data[k].pres);
      break;
    }
  }

  if (Hupr != AMIS && Hlow != AMIS) {
    delP=(Math.log(lfc.p)-Math.log(Plow))/(Math.log(Pupr)-Math.log(Plow))
    Hel=Hlow+(Hupr-Hlow)*delP;
  }

  for (var k=0; k<data.length; k++) {
    if (lcl.p > parseFloat(data[k].pres)) {
      Hlow=parseFloat(data[k-1].gh);
      if (data[k-1].gh == undefined || parseFloat(data[k-1].gh) == AMIS) {
        Hlow = std_atmos(parseFloat(data[k-1].pres)*100);
      }
      Plow=parseFloat(data[k-1].pres);
      Hupr=parseFloat(data[k].gh)
      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Hupr = std_atmos(parseFloat(data[k].pres)*100);
      }
      Pupr=parseFloat(data[k].pres);
      break;
    }
  }

  if (Hupr != AMIS && Hlow != AMIS) {
    delP=(Math.log(lcl.p)-Math.log(Plow))/(Math.log(Pupr)-Math.log(Plow))
    Hlfc=Hlow+(Hupr-Hlow)*delP;
  }

  // CALCULATE CIN FROM LCL TO LFC
  var Sum_lfc=0.;
  var tr_Tlfc=2.*(Tpcl[0]-Tenv[0])/(lfc.t+Tenv[0]);
  var Sum_lfc=0.5*(Hlfc-Henv[0])*tr_Tlfc*9.8;
  var TSUM1=Sum_lfc;

  kk = Tenv.length-1;
  var delh, delt, avet, sum;
  for (var k=0; k<kk; k++) {
    delh=Henv[k]-Henv[k+1];
    delt=0.5*((Tpcl[k]-Tenv[k])+(Tpcl[k+1]-Tenv[k+1]));
    avet=0.5*(Tenv[k]+Tenv[k+1]);
    sum=(delh*delt/avet)*9.8;
    TSUM1=TSUM1+sum;
  }
 
  TCIN = -TSUM1;

  // CALCULATE DRY ADIABATIC LINE FROM LCL TO 1000hPa
  var RAD=Math.acos(-1.)/180.;
  var RCP=0.286;
  var P0=100000.;
  var DT=0.;
  var IDRY = 0;
  var JMAX = parseInt(data[0].pres);
  var PSATM = [], TSATM = [];
  var P, PPP, T, PLBL, TLBL;

  for (var j=parseInt(lcl.p); j<=JMAX; j++) {
    PSATM[IDRY]=j*1.;
    P=PSATM[IDRY]*100.;
    PPP=Math.pow((P0/P),RCP);
    T=DT+(parseFloat(data[0].ta)+C2K)/PPP;

    if (IDRY == 0) {
      PSATM[IDRY] = lcl.p;
      TSATM[IDRY] = lcl.t;
      DT = lcl.t - T;
    }
    else {
      TSATM[IDRY] = T;
    }

    if (j == JMAX) {
      PLBL = PSATM[IDRY];
      TLBL = TSATM[IDRY];
    }

    IDRY++;
  }

  // SEARCH LBL CROSS POINT BELOW LCL
  var MXBL = IDRY;
  var ATEMP, BTEMP, DIFF_I, DIFF_J, DRATE, DPMB, UPMB, DTMP, UTMP, VTEMP, DTRS, DIFF;
  var chk = false;
  for (var n=data.length-1; n>0; n--) {
    if (parseFloat(data[n-1].pres) <= lcl.p) {
      continue;
    }

    ATEMP = parseFloat(data[n-1].ta);
    BTEMP = parseFloat(data[n].ta);

    for (var m=0; m<IDRY; m++) {
      if (parseInt(data[n].pres) == parseInt(PSATM[m])) {
        DIFF_J=BTEMP-(TSATM[m]-C2K);
        for (var l=m+1; l<IDRY; l++) {
          DIFF_I=ATEMP-(TSATM[l]-C2K);
          break;
        }

        if ((DIFF_I*DIFF_J) <= 0 || (n == 1)) {
            DRATE=(ATEMP-BTEMP)/(-parseFloat(data[n].pres)+parseFloat(data[n-1].pres));
            DPMB=parseFloat(data[n-1].pres);
            DTMP=BTEMP;
            UPMB=parseFloat(data[n].pres);
            UTMP=ATEMP;
            chk = true;
            break;
        }
      }
    }

    if (chk) {
      break;
    }
  }

  if (chk) {
    VTEMP=DTMP;
    DTRS=1.;

    for (var m=0; m<IDRY; m++) {
      if (parseInt(PSATM[m])<=parseInt(DPMB) && parseInt(PSATM[m])>=parseInt(UPMB)) {
        DIFF = Math.abs(VTEMP-(TSATM[m]-C2K));
        if (DIFF < DTRS) {
          DTRS=DIFF;
          PLBL=PSATM[m];
          TLBL=TSATM[m];
          MXBL=m;
        }
        VTEMP=VTEMP+DRATE;
      }
    }
  }

  // DRAW AND FILLING CIN AREA FROM LBL TO LCL
  var ICHK;
  var Tenv = [], Penv = [], Henv = [], Tpcl = [];
  kk=0;
  if (PLBL == parseInt(data[0].pres)) {
    ICHK=-1;
    for (var k=0; k<data.length; k++) {
      if (parseFloat(data[k].pres) < PLBL) {
        ICHK=k;
        break;
      }
    }
  }

  if (ICHK > 0) {
    P=parseFloat(data[ICHK-1].pres)*100.;
    T=parseFloat(data[ICHK-1].ta)+C2K;
    Penv[kk]=parseFloat(data[ICHK-1].pres);
    Henv[kk]=parseFloat(data[ICHK-1].gh);
    if (data[ICHK-1].gh == undefined || parseFloat(data[ICHK-1].gh) == AMIS) {
      Henv[kk]=std_atmos(parseFloat(data[ICHK-1].pres)*100);
    }
    Tenv[kk]=T;
    Tpcl[kk]=TLBL;
    kk=kk+1;

    for (var j=0; j<IDRY; j++) {
      if (parseInt(PSATM[j]) == parseInt(data[ICHK-1].pres)) {
        PLBL=PSATM[j];
        TLBL=TSATM[j];
        break;
      }
    }
  }

  for (var k=0; k<data.length; k++) {
    if (parseFloat(data[k].ta) > AMIS && parseFloat(data[k].pres) < PLBL && parseFloat(data[k].pres) > lcl.p) {
      P=parseFloat(data[k].pres)*100.;
      T=parseFloat(data[k].ta)+C2K;

      Tenv[kk]=T;
      Penv[kk]=parseFloat(data[k].pres);
      Henv[kk]=parseFloat(data[k].gh);

      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Henv[kk] = std_atmos(parseFloat(data[k].pres)*100);
      }

      if (data[k+1].gh == undefined || parseFloat(data[k+1].gh) == AMIS) {
        Henv[kk+1] = std_atmos(parseFloat(data[k+1].pres)*100);
      }

      for (var n=0; n<IDRY; n++) {
        if (parseInt(PSATM[n]) == parseInt(data[k].pres)) {
          Tpcl[kk] = TSATM[n];
          if (Tpcl[kk] >= Tenv[kk]) {
            cin.value = TCIN;
            return cin;
          }
          break;
        }
      }

      kk++;
    }
  }

  // SEARCH Tenv AT LCL HEIGHT
  Tenv[kk]=Tlcle+C2K;
  Penv[kk]=lcl.p;
  Henv[kk]=Hlcle;
  Tpcl[kk]=lcl.t;
  kk++;

  // CALCULATE GPH FOR LBL AND LCL
  var HLBL=AMIS;
  var KCHK = -1;
  Hlow=AMIS; Plow=AMIS; Hupr=AMIS; Pupr=AMIS;
  for (k=0; k<data.length; k++) {
    if (PLBL > parseFloat(data[k].pres)) {
      Hlow=parseFloat(data[k-1].gh);
      if (data[k-1].gh == undefined || parseFloat(data[k-1].gh) == AMIS) {
        Hlow = std_atmos(parseFloat(data[k-1].pres)*100);
      }
      Plow=parseFloat(data[k-1].pres);
      Hupr=parseFloat(data[k].gh);
      if (data[k].gh == undefined || parseFloat(data[k].gh) == AMIS) {
        Hupr = std_atmos(parseFloat(data[k].pres)*100);
      }
      Pupr=parseFloat(data[k].pres);
      KCHK=k;
    }
  }

  if (KCHK > 0 && Hupr != AMIS && Hlow != AMIS) {
     delP=(Math.log(PLBL)-Math.log(Plow))/(Math.log(Pupr)-Math.log(Plow));
     HLBL=Hlow+(Hupr-Hlow)*delP;
  }

  // CALCULATE CIN FROM LBL TO LCL
  var Sum_lbl=0.;

  var tr_Tlbl=2*(Tpcl[0]-Tenv[0])/(TLBL+Tenv[0]);
  var Sum_lbl=0.5*(Henv[0]-HLBL)*tr_Tlbl*9.8;
  if (PLBL < 1000.) Sum_lbl=(Henv[0]-HLBL)*tr_Tlbl*9.8;
  var TSUM2=Sum_lbl;

  kk = Tenv.length-1;
  for (k=0; k<kk; k++) {
    delh=Henv[k+1]-Henv[k];
    delt=0.5*((Tpcl[k]-Tenv[k])+(Tpcl[k+1]-Tenv[k+1]));
    avet=0.5*(Tenv[k]+Tenv[k+1]);
    sum=(delh*delt/avet)*9.8;
    TSUM2=TSUM2+sum;
  }

  TCIN=TCIN-TSUM2;

  if (TCIN <= 0) {
    TCIN=AMIS;
  }
  else {
    for (var k=data.length-1; k>=0; k--) {
      if (parseFloat(data[k].pres) >= PLBL || parseFloat(data[k].pres) <= lfc.p) {
        continue;
      }
      var d = {};
      d.ta = parseFloat(data[k].ta);
      d.pres = parseFloat(data[k].pres);
      polygon.push(d) 
    }

    if (parseInt(PLBL) == parseInt(data[0].pres) && TLBL-C2K != parseFloat(data[0].ta)) {
      var d = {};
      d.ta = parseFloat(data[0].ta);
      d.pres = PLBL;
      polygon.push(d);
    }

    var d = {};
    d.ta = TLBL - C2K;
    d.pres = PLBL;
    polygon.push(d);

    for (var j=IDRY-1; j>=0; j--) {
      var d = {};
      d.ta = TSATM[j] - C2K;
      d.pres = PSATM[j];
      polygon.push(d) 
    }

    cin.polygon = polygon;
  }

  cin.value = TCIN;

  return cin;
}

function calcMidval(Pm,Pl,Pu,Tl,Tu) {
  var value = Tl+(Pm-Pl)*(Tu-Tl)/(Pu-Pl);
  return value;
}

function calcRH(ta, td) {
  var RH;
  var ESTD = calcVapor(td);
  var EST = calcVapor(ta);

  if (EST == 0) {
    RH = -999;
  }
  else {
    RH = (ESTD/EST)*100.;
  }

  return RH;
}

function calcTw(data) {
  var C2K = 273.15;

  for (var k=0; k<data.length; k++) {
    if (data[k].pres == "SFC") {
      var pres = parseFloat(data[k].ps);
    }
    else if (parseFloat(data[k].pres) < 300 || data[k].ta <= -999 || data[k].td <= -999) {
      continue;
    }
    else {
      var pres = parseFloat(data[k].pres);
    }

    var TSATM = [], PSATM = [];

    var lcl = calcLcl(pres, parseFloat(data[k].ta), parseFloat(data[k].td));
    var isat = satarry1(lcl.p,lcl.t,TSATM,PSATM);

    for (var m=0; m<isat; m++) {
      if (parseInt(pres) == parseInt(PSATM[m])) {
        data[k].tw = TSATM[m] - C2K;
        break;
      }
    }
  }

  return;
}

function calcCVT(data, ccl) {
  var CVT = -99.;
  var C2K = 273.15;
  var AKAPPA = 0.28586;

  CVT = (ccl.t)*Math.pow(parseFloat(data[0].pres)/ccl.p, AKAPPA) - C2K;

  return CVT;
}

function calcTPW(data)
{
  var g = 980.616;
  var pw = 0.;

  var wbot = wmr(data[0].pres,data[0].td);
  var wtop;

  for (var k=0; k<data.length-1; k++) {
    if (data[k+1].pres <= 100) {
      break;
    }

    wtop = wmr(data[k+1].pres,data[k+1].td);
    var w = 0.5*(wtop+wbot);
    var wl = .001*w;

    var ql = wl/(wl+1.);

    var dp = 1000.*(data[k].pres-data[k+1].pres)
    var pw = pw+(ql/g)*dp;
    wbot = wtop;
  }
  
  // cm to mm
  return pw*10;
}

function wmr(p,t)
{
  var eps = 0.62197;

  var x = 0.02*(t-12.5+7500./p);
  var wfw = 1. + 4.5*Math.pow(10,-6)*p + 1.4*Math.pow(10,-3)*x*x;
  var fwesw = wfw*esw(t);
  var r = eps*fwesw/(p-fwesw);

  return 1000.*r;
}

function esw(t)
{
  var es0 = 6.1078;

  var pol = 0.99999683 + t*(-0.90826951*Math.pow(10,-2) + t*(0.78736169*Math.pow(10,-4) + t*(-0.61117958*Math.pow(10,-6)
            + t*(0.43884187*Math.pow(10,-8) + t*(-0.29883885*Math.pow(10,-10) + t*(0.21874425*Math.pow(10,-12) + t*(-0.17892321*Math.pow(10,-14)
            + t*(0.11112018*Math.pow(10,-16) + t*(-0.30994571*Math.pow(10,-19))))))))));

  return es0/Math.pow(pol,8);
}