!macro customInstall
  ; Ensure the installation directory always ends with \GameTime Tracker
  StrLen $R0 "$INSTDIR"
  IntOp $R1 $R0 - 16
  StrCpy $R2 "$INSTDIR" 16 $R1
  StrCmp $R2 "GameTime Tracker" skip_append
    StrCpy $INSTDIR "$INSTDIR\GameTime Tracker"
  skip_append:
!macroend
