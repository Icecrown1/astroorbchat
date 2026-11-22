package app.astroorbi.store;

import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

// Read-only product discovery until purchase verification is available on the server.
@CapacitorPlugin(name = "PlayCatalog")
public class PlayCatalog extends Plugin {
    @PluginMethod
    public void query(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            BillingClient client = BillingClient.newBuilder(getContext())
                .setListener((result, purchases) -> {})
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .build();
            client.startConnection(new BillingClientStateListener() {
                @Override public void onBillingServiceDisconnected() {
                    finish(client, call, null, "DISCONNECTED");
                }
                @Override public void onBillingSetupFinished(BillingResult result) {
                    if (result.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        finish(client, call, null, "BILLING_" + result.getResponseCode());
                        return;
                    }
                    JSArray products = new JSArray();
                    queryGroup(client, call, products, true);
                }
            });
        });
    }

    private void queryGroup(BillingClient client, PluginCall call, JSArray products, boolean packs) {
        String type = packs ? BillingClient.ProductType.INAPP : BillingClient.ProductType.SUBS;
        String[] ids = packs ? new String[]{"s50", "s100", "s250"} : new String[]{"standard", "premium"};
        List<QueryProductDetailsParams.Product> request = new ArrayList<>();
        for (String id : ids) {
            request.add(QueryProductDetailsParams.Product.newBuilder().setProductType(type).setProductId(id).build());
        }
        client.queryProductDetailsAsync(QueryProductDetailsParams.newBuilder().setProductList(request).build(),
            (status, details) -> {
                if (status.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                    finish(client, call, null, "BILLING_" + status.getResponseCode());
                    return;
                }
                for (ProductDetails item : details.getProductDetailsList()) products.put(item.getProductId());
                if (packs) queryGroup(client, call, products, false);
                else finish(client, call, products, null);
            });
    }

    private void finish(BillingClient client, PluginCall call, JSArray products, String error) {
        // The service may disconnect while a product query is outstanding.
        synchronized (call) {
            if (call.isReleased()) return;
            if (error == null) {
                JSObject result = new JSObject();
                result.put("products", products);
                call.resolve(result);
            } else call.reject(error);
            call.release(getBridge());
        }
        client.endConnection();
    }
}
