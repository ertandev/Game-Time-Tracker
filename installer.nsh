!macro customHeader
  !include nsDialogs.nsh
  !include LogicLib.nsh

  !ifndef BUILD_UNINSTALLER
    Var Checkbox_Desktop
    Var Checkbox_StartMenu
    Var Checkbox_Desktop_State
    Var Checkbox_StartMenu_State

    # Define localized strings
    LangString SHORTCUTS_HEADER_TITLE ${LANG_ENGLISH} "Shortcut Options"
    LangString SHORTCUTS_HEADER_SUBTITLE ${LANG_ENGLISH} "Choose which shortcuts you want to create."
    LangString CREATE_DESKTOP_SHORTCUT ${LANG_ENGLISH} "Create Desktop Shortcut"
    LangString CREATE_START_MENU_SHORTCUT ${LANG_ENGLISH} "Create Start Menu Shortcut"
  !endif

  Function .onVerifyInstDir
    ; Check if path is empty
    StrCmp "$INSTDIR" "" done

    ; Get length of $INSTDIR
    StrLen $0 "$INSTDIR"
    ; If length is 2 or 3, check if it's a root drive (e.g. "D:\" or "D:")
    IntCmp $0 2 is_root
    IntCmp $0 3 is_root done

  is_root:
    ; Get second character (index 1) to verify it has ":"
    StrCpy $1 "$INSTDIR" 1 1
    StrCmp $1 ":" append_folder done

  append_folder:
    ; Check if last character is backslash to prevent double backslashes
    StrCpy $1 "$INSTDIR" 1 -1
    StrCmp $1 "\" has_slash
      StrCpy $INSTDIR "$INSTDIR\GameTime Tracker"
      Goto done
    has_slash:
      StrCpy $INSTDIR "$INSTDIRGameTime Tracker"
      Goto done

  done:
  FunctionEnd

  !ifndef BUILD_UNINSTALLER
    Function StartShortcutsPage
      # Skip this page if it's an update
      ${If} ${isUpdated}
        Abort
      ${EndIf}

      # Create the dialog
      nsDialogs::Create 1018
      Pop $0
      ${If} $0 == error
        Abort
      ${EndIf}

      !insertmacro MUI_HEADER_TEXT "$(SHORTCUTS_HEADER_TITLE)" "$(SHORTCUTS_HEADER_SUBTITLE)"

      # Desktop shortcut checkbox
      ${NSD_CreateCheckbox} 10u 10u 100% 12u "$(CREATE_DESKTOP_SHORTCUT)"
      Pop $Checkbox_Desktop
      # Set default state to checked if state is empty
      ${If} $Checkbox_Desktop_State == ""
        StrCpy $Checkbox_Desktop_State ${BST_CHECKED}
      ${EndIf}
      ${NSD_SetState} $Checkbox_Desktop $Checkbox_Desktop_State

      # Start menu shortcut checkbox
      ${NSD_CreateCheckbox} 10u 25u 100% 12u "$(CREATE_START_MENU_SHORTCUT)"
      Pop $Checkbox_StartMenu
      # Set default state to checked if state is empty
      ${If} $Checkbox_StartMenu_State == ""
        StrCpy $Checkbox_StartMenu_State ${BST_CHECKED}
      ${EndIf}
      ${NSD_SetState} $Checkbox_StartMenu $Checkbox_StartMenu_State

      nsDialogs::Show
    FunctionEnd

    Function StartShortcutsPageLeave
      ${NSD_GetState} $Checkbox_Desktop $Checkbox_Desktop_State
      ${NSD_GetState} $Checkbox_StartMenu $Checkbox_StartMenu_State
    FunctionEnd
  !endif
!macroend

!macro customPageAfterChangeDir
  !ifndef BUILD_UNINSTALLER
    Page custom StartShortcutsPage StartShortcutsPageLeave
  !endif
!macroend

!macro customInstall
  # Create Desktop Shortcut if checked
  ${If} $Checkbox_Desktop_State == ${BST_CHECKED}
    CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${EndIf}

  # Create Start Menu Shortcut if checked
  ${If} $Checkbox_StartMenu_State == ${BST_CHECKED}
    !ifdef MENU_FILENAME
      CreateDirectory "$SMPROGRAMS\${MENU_FILENAME}"
      ClearErrors
    !endif
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
    ClearErrors
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  ${EndIf}
!macroend

!macro customUnInstall
  # Delete the desktop shortcut
  WinShell::UninstShortcut "$oldDesktopLink"
  Delete "$oldDesktopLink"

  # Delete the start menu shortcut
  WinShell::UninstShortcut "$oldStartMenuLink"
  Delete "$oldStartMenuLink"
  
  # Delete the start menu folder if it was created and is now empty
  ReadRegStr $R1 SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" MenuDirectory
  ${ifNot} $R1 == ""
    RMDir "$SMPROGRAMS\$R1"
  ${endIf}
!macroend
