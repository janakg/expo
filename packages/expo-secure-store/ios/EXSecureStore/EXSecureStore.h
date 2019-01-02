// Copyright 2015-present 650 Industries. All rights reserved.


#import <EXCore/EXExportedModule.h>
#import <React/RCTBridgeModule.h>

@class EXSecureStore;

typedef NS_ENUM(NSInteger, EXSecureStoreAccessible) {
  EXSecureStoreAccessibleAfterFirstUnlock = 0,
  EXSecureStoreAccessibleAfterFirstUnlockThisDeviceOnly = 1,
  EXSecureStoreAccessibleAlways = 2,
  EXSecureStoreAccessibleWhenPasscodeSetThisDeviceOnly = 3,
  EXSecureStoreAccessibleAlwaysThisDeviceOnly = 4,
  EXSecureStoreAccessibleWhenUnlocked = 5,
  EXSecureStoreAccessibleWhenUnlockedThisDeviceOnly = 6
};

@interface EXSecureStore : EXExportedModule <RCTBridgeModule>
@end