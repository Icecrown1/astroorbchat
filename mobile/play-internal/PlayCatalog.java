package app.astroorbi.store;

import android.content.Intent;
import android.net.Uri;
import com.android.billingclient.api.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

// Play catalog and regional checkout for the internal Android build.
@CapacitorPlugin(name = "PlayCatalog")
public class PlayCatalog extends Plugin {
    @PluginMethod
    public void query(PluginCall call) {
        connect(call, false);
    }

    @PluginMethod
    public void region(PluginCall call) {
        connect(call, true);
    }

    @PluginMethod
    public void openCheckout(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        String host = uri.getHost();
        if (!"https".equals(uri.getScheme()) || uri.getUserInfo() != null ||
            (uri.getPort() != -1 && uri.getPort() != 443) || host == null ||
            !(host.equals("yoomoney.ru") || host.endsWith(".yoomoney.ru") ||
              host.equals("yookassa.ru") || host.endsWith(".yookassa.ru"))) {
            call.reject("INVALID_CHECKOUT_URL");
            return;
        }
        try {
            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
            call.resolve();
        } catch (android.content.ActivityNotFoundException ex) {
            call.reject("NO_BROWSER");
        }
    }

    private boolean isReturn(Intent intent) {
        return intent != null && "astroorbi://payment-return".equals(intent.getDataString());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        if (isReturn(intent)) notifyListeners("paymentReturn", new JSObject(), true);
    }

    @PluginMethod
    public void consumeReturn(PluginCall call) {
        Intent intent = getActivity().getIntent();
        boolean returning = isReturn(intent);
        if (returning) intent.setData(null);
        JSObject reply = new JSObject();
        reply.put("returning", returning);
        call.resolve(reply);
    }

    private void connect(PluginCall call, boolean regionOnly) {
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
                    if (regionOnly) {
                        client.getBillingConfigAsync(GetBillingConfigParams.newBuilder().build(), (status, config) -> {
                            if (status.getResponseCode() != BillingClient.BillingResponseCode.OK || config == null) {
                                finish(client, call, null, "REGION_UNAVAILABLE");
                                return;
                            }
                            JSObject data = new JSObject();
                            data.put("russianStore", "RU".equals(config.getCountryCode()));
                            finish(client, call, data, null);
                        });
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
                else {
                    JSObject data = new JSObject();
                    data.put("products", products);
                    finish(client, call, data, null);
                }
            });
    }

    private void finish(BillingClient client, PluginCall call, JSObject data, String error) {
        // The service may disconnect while a product query is outstanding.
        synchronized (call) {
            if (call.isReleased()) return;
            if (error == null) {
                call.resolve(data);
            } else call.reject(error);
            call.release(getBridge());
        }
        client.endConnection();
    }
}
