package com.casper.realmines;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.graphics.Color;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.BLACK), SystemBarStyle.dark(Color.BLACK));
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);
    }
}
